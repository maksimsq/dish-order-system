const express = require('express');
const router = express.Router();
const {
  calculateAndValidateOrder,
  createOrder,
  getOrderDetails
} = require('../services/orderService');
const { addOrderClient } = require('../services/sseService');

// попередній розрахунок вартості кошика на сервері
router.post('/calculate', (req, res) => {
  try {
    const { items, slotTime } = req.body;
    const result = calculateAndValidateOrder(items, slotTime);
    res.json({
      success: true,
      data: {
        grandTotal: result.grandTotal,
        itemsCount: result.processedItems.length
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// створення нового замовлення
router.post('/', (req, res) => {
  try {
    const order = createOrder(req.body);
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// отримання стану замовлення за його номером
router.get('/:orderNumber', (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = getOrderDetails(orderNumber);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'замовлення не знайдено'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// підключення до потоку подій sse для відстеження замовлення
router.get('/:orderNumber/events', (req, res) => {
  const { orderNumber } = req.params;
  const order = getOrderDetails(orderNumber);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'замовлення не знайдено для підключення sse'
    });
  }

  // налаштовуємо sse заголовки
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // надсилаємо початковий стан
  res.write(`data: ${JSON.stringify({ type: 'INITIAL_STATE', data: order, timestamp: new Date().toISOString() })}\n\n`);

  // реєструємо клієнта
  addOrderClient(orderNumber, res);
});

// демонстраційна перевірка спроби клієнта самостійно змінити статус на виконано
router.post('/:orderNumber/client-status-attempt', (req, res) => {
  // клієнт не має токена оператора закладу
  res.status(403).json({
    success: false,
    error: 'відмовлено у доступі (403): клієнт не має прав оператора для зміни статусу замовлення на "виконано"'
  });
});

module.exports = router;
