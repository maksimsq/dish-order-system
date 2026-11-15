const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireOperator } = require('../middlewares/auth');
const { updateOrderStatus, getOrderDetails } = require('../services/orderService');
const { addOperatorClient, notifyOperators } = require('../services/sseService');

// публічний маршрут авторизації персоналу
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // перевірка облікового запису розробника
  if ((username === 'developer' || username === 'dev') && password === 'dev') {
    return res.json({
      success: true,
      token: 'dev',
      role: 'developer',
      name: 'Головний розробник (Developer)'
    });
  }

  // перевірка облікового запису оператора
  if ((username === 'operator' || username === 'admin') && (password === '123' || password === 'operator123' || password === 'admin')) {
    return res.json({
      success: true,
      token: 'operator_secret_token_123',
      role: 'operator',
      name: 'Оператор зміни'
    });
  }

  return res.status(401).json({
    success: false,
    error: 'невірний логін або пароль'
  });
});

// захищаємо всі інші операторські маршрути перевіркою токена
router.use(requireOperator);

// перевірка валідності токена оператора
router.get('/auth-check', (req, res) => {
  res.json({ success: true, message: 'авторизація успішна' });
});

// отримання списку всіх замовлень
router.get('/orders', (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM orders';
    const params = [];

    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY id DESC';
    const orders = db.prepare(query).all(...params);

    // додаємо позиції до кожного замовлення
    const fullOrders = orders.map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      const itemsWithMods = items.map(item => {
        const mods = db.prepare('SELECT * FROM order_item_modifiers WHERE order_item_id = ?').all(item.id);
        return { ...item, modifiers: mods };
      });
      return { ...order, items: itemsWithMods };
    });

    res.json({
      success: true,
      data: fullOrders
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// зміна статусу замовлення оператором
router.patch('/orders/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = updateOrderStatus(id, status);
    res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// керування доступністю страви оператором
router.patch('/dishes/:id/availability', (req, res) => {
  try {
    const { id } = req.params;
    const { is_available } = req.body;

    db.prepare('UPDATE dishes SET is_available = ? WHERE id = ?').run(is_available ? 1 : 0, id);
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);

    // сповіщаємо операторів та клієнтів про зміну доступності
    notifyOperators('DISH_AVAILABILITY_CHANGED', dish);

    res.json({
      success: true,
      data: dish
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// отримання системних налаштувань
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// оновлення системних налаштувань
router.patch('/settings', (req, res) => {
  try {
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    }

    // дістаємо оновлені налаштування
    const rows = db.prepare("SELECT key, value FROM settings WHERE key != 'operator_token'").all();
    const currentSettings = {};
    for (const r of rows) {
      currentSettings[r.key] = r.value;
    }

    notifyOperators('SETTINGS_UPDATED', currentSettings);

    res.json({ success: true, message: 'налаштування збережено', data: currentSettings });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// підключення операторської панелі до sse
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'панель оператора підключена', timestamp: new Date().toISOString() })}\n\n`);

  addOperatorClient(res);
});

module.exports = router;
