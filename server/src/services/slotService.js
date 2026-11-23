const { db } = require('../db');

// генерація списку слотів та розрахунок заповненості
function getAvailableSlots(dateStr) {
  // отримуємо налаштування закладу
  const openTimeSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('opening_time');
  const closeTimeSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('closing_time');
  const maxOrdersSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('max_orders_per_slot');
  const intervalSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('slot_interval_minutes');

  const openHour = parseInt((openTimeSetting?.value || '10:00').split(':')[0], 10);
  const openMin = parseInt((openTimeSetting?.value || '10:00').split(':')[1], 10);
  const closeHour = parseInt((closeTimeSetting?.value || '22:00').split(':')[0], 10);
  const closeMin = parseInt((closeTimeSetting?.value || '22:00').split(':')[1], 10);

  const maxOrders = parseInt(maxOrdersSetting?.value || '3', 10);
  const stepMinutes = parseInt(intervalSetting?.value || '20', 10);

  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  const slots = [];
  let current = new Date(`${targetDate}T${String(openHour).padStart(2, '0')}:${String(openMin).padStart(2, '0')}:00`);
  const end = new Date(`${targetDate}T${String(closeHour).padStart(2, '0')}:${String(closeMin).padStart(2, '0')}:00`);

  // отримуємо поточну завантаженість слотів з бази
  const countStmt = db.prepare(`
    SELECT slot_time, COUNT(*) as count 
    FROM orders 
    WHERE status != 'cancelled' AND slot_time LIKE ?
    GROUP BY slot_time
  `);
  const occupiedRows = countStmt.all(`${targetDate}%`);
  const occupiedMap = new Map();
  for (const row of occupiedRows) {
    occupiedMap.set(row.slot_time, row.count);
  }

  const now = new Date();

  while (current < end) {
    const next = new Date(current.getTime() + stepMinutes * 60000);
    const startStr = current.toTimeString().slice(0, 5);
    const endStr = next.toTimeString().slice(0, 5);

    const slotKey = `${targetDate} ${startStr}-${endStr}`;
    const ordersCount = occupiedMap.get(slotKey) || 0;

    // перевіряємо чи час ще не минув для сьогодні
    const isPast = current < now;
    const isFull = ordersCount >= maxOrders;
    const isAvailable = !isPast && !isFull;

    slots.push({
      slot_key: slotKey,
      date: targetDate,
      time_range: `${startStr} - ${endStr}`,
      current_orders: ordersCount,
      max_orders: maxOrders,
      is_past: isPast,
      is_full: isFull,
      is_available: isAvailable
    });

    current = next;
  }

  return slots;
}

// перевірка конкретного слоту при замовленні
function validateSlot(slotKey) {
  const maxOrdersSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('max_orders_per_slot');
  const maxOrders = parseInt(maxOrdersSetting?.value || '3', 10);

  // рахуємо скільки вже замовлень на цей слот
  const countRow = db.prepare(`
    SELECT COUNT(*) as count 
    FROM orders 
    WHERE slot_time = ? AND status != 'cancelled'
  `).get(slotKey);

  const currentCount = countRow ? countRow.count : 0;
  if (currentCount >= maxOrders) {
    return {
      valid: false,
      reason: `ліміт замовлень на інтервал ${slotKey} вичерпано`
    };
  }

  return { valid: true };
}

module.exports = {
  getAvailableSlots,
  validateSlot
};
