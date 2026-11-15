const { db } = require('../db');
const { validateSlot } = require('./slotService');
const { notifyOrderStatusChange, notifyOperators } = require('./sseService');

// перевірка роботи закладу
function checkRestaurantStatus() {
  const openSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('is_open');
  if (!openSetting || openSetting.value !== '1') {
    return { open: false, reason: 'заклад зараз зачинено адміністратором' };
  }
  return { open: true };
}

// розрахунок суми та валідація замовлення на сервері
function calculateAndValidateOrder(cartItems, slotTime, idempotencyKey) {
  // 1. перевірка чи заклад відчинено
  const restStatus = checkRestaurantStatus();
  if (!restStatus.open) {
    throw new Error(restStatus.reason);
  }

  // 2. перевірка наявності позицій
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('кошик порожній, додайте хоча б одну страву');
  }

  // 3. перевірка часового інтервалу
  if (!slotTime) {
    throw new Error('необхідно вибрати інтервал отримання замовлення');
  }
  const slotCheck = validateSlot(slotTime);
  if (!slotCheck.valid) {
    throw new Error(slotCheck.reason);
  }

  // 4. перевірка кожної страви та розрахунок вартості
  let grandTotal = 0;
  const processedItems = [];

  for (const item of cartItems) {
    const { dishId, quantity, modifierIds = [] } = item;

    if (!dishId || !quantity || quantity < 1) {
      throw new Error('некоректна кількість або ідентифікатор страви');
    }

    // дістаємо актуальну страву з бази
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(dishId);
    if (!dish) {
      throw new Error(`страву з кодом ${dishId} не знайдено в меню`);
    }

    // перевіряємо доступність страви
    if (dish.is_available !== 1) {
      throw new Error(`страва "${dish.name}" наразі недоступна для замовлення`);
    }

    // отримуємо групи модифікаторів для страви
    const groups = db.prepare('SELECT * FROM modifier_groups WHERE dish_id = ?').all(dishId);
    
    // отримуємо всі доступні модифікатори для страви
    const validModifiers = [];
    let modifiersCost = 0;

    // групуємо обрані модифікатори за групами для перевірки min/max
    const selectedModsByGroup = new Map();

    if (modifierIds && modifierIds.length > 0) {
      for (const modId of modifierIds) {
        const mod = db.prepare(`
          SELECT m.*, mg.id as group_id, mg.name as group_name, mg.min_selection, mg.max_selection, mg.is_required
          FROM modifiers m
          JOIN modifier_groups mg ON m.group_id = mg.id
          WHERE m.id = ? AND mg.dish_id = ?
        `).get(modId, dishId);

        if (!mod) {
          throw new Error(`невідомий або недозволений модифікатор для страви "${dish.name}"`);
        }

        if (mod.is_available !== 1) {
          throw new Error(`модифікатор "${mod.name}" наразі недоступний`);
        }

        validModifiers.push(mod);
        modifiersCost += mod.price;

        const countInGroup = selectedModsByGroup.get(mod.group_id) || 0;
        selectedModsByGroup.set(mod.group_id, countInGroup + 1);
      }
    }

    // перевіряємо правила кількості модифікаторів для кожної групи
    for (const group of groups) {
      const selectedCount = selectedModsByGroup.get(group.id) || 0;

      if (group.is_required && selectedCount < group.min_selection) {
        throw new Error(`для страви "${dish.name}" обов-язково оберіть категорію "${group.name}" (мінімум ${group.min_selection})`);
      }

      if (selectedCount > group.max_selection) {
        throw new Error(`перевищено допустиму кількість модифікаторів у групі "${group.name}" (максимум ${group.max_selection})`);
      }
    }

    const itemTotal = (dish.base_price + modifiersCost) * quantity;
    grandTotal += itemTotal;

    processedItems.push({
      dish,
      quantity,
      modifiers: validModifiers,
      itemTotal
    });
  }

  return {
    grandTotal: Math.round(grandTotal * 100) / 100,
    processedItems
  };
}

// створення нового замовлення
function createOrder(orderPayload) {
  const {
    clientName,
    clientPhone,
    clientEmail,
    deliveryType = 'pickup',
    slotTime,
    notes = '',
    idempotencyKey,
    items
  } = orderPayload;

  // перевірка на дублювання за ключем ідемпотентності
  if (idempotencyKey) {
    const existing = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?').get(idempotencyKey);
    if (existing) {
      // повертаємо існуюче замовлення без повторного списання
      return getOrderDetails(existing.order_number);
    }
  }

  // валідація та серверний підрахунок вартості
  const { grandTotal, processedItems } = calculateAndValidateOrder(items, slotTime, idempotencyKey);

  // генеруємо номер замовлення
  const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `ORD-${datePrefix}-${randomSuffix}`;

  const nowIso = new Date().toISOString();

  // запис замовлення в транзакції
  db.exec('BEGIN TRANSACTION');
  try {
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_number, client_name, client_phone, client_email,
        status, delivery_type, slot_time, total_price, notes,
        idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertOrder.run(
      orderNumber,
      clientName || 'Гість',
      clientPhone || '',
      clientEmail || '',
      deliveryType,
      slotTime,
      grandTotal,
      notes,
      idempotencyKey || null,
      nowIso,
      nowIso
    );

    const orderId = result.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, dish_id, dish_name, dish_price, quantity, item_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMod = db.prepare(`
      INSERT INTO order_item_modifiers (order_item_id, modifier_id, modifier_name, modifier_price)
      VALUES (?, ?, ?, ?)
    `);

    for (const pItem of processedItems) {
      const itemRes = insertItem.run(
        orderId,
        pItem.dish.id,
        pItem.dish.name,
        pItem.dish.base_price,
        pItem.quantity,
        pItem.itemTotal
      );
      const orderItemId = itemRes.lastInsertRowid;

      for (const mod of pItem.modifiers) {
        insertMod.run(
          orderItemId,
          mod.id,
          mod.name,
          mod.price
        );
      }
    }

    db.exec('COMMIT');

    const createdOrder = getOrderDetails(orderNumber);

    // надсилаємо сповіщення операторам у реальному часі
    notifyOperators('NEW_ORDER', createdOrder);

    return createdOrder;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// отримання деталей замовлення з позиціями та модифікаторами
function getOrderDetails(orderNumber) {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
  if (!order) return null;

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  const fullItems = items.map(item => {
    const mods = db.prepare('SELECT * FROM order_item_modifiers WHERE order_item_id = ?').all(item.id);
    return {
      ...item,
      modifiers: mods
    };
  });

  return {
    ...order,
    items: fullItems
  };
}

// оновлення статусу замовлення оператором
function updateOrderStatus(orderIdOrNumber, newStatus) {
  const allowedStatuses = ['new', 'cooking', 'ready', 'completed', 'cancelled'];
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error(`невідомий статус: ${newStatus}`);
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(orderIdOrNumber, orderIdOrNumber);
  if (!order) {
    throw new Error('замовлення не знайдено');
  }

  const nowIso = new Date().toISOString();
  db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, nowIso, order.id);

  const updatedOrder = getOrderDetails(order.order_number);

  // надсилаємо sse оновлення клієнту й операторам
  notifyOrderStatusChange(order.order_number, updatedOrder);

  return updatedOrder;
}

module.exports = {
  checkRestaurantStatus,
  calculateAndValidateOrder,
  createOrder,
  getOrderDetails,
  updateOrderStatus
};
