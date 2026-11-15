const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { addGlobalClient } = require('../services/sseService');

// публічні налаштування для клієнта
router.get('/', (req, res) => {
  try {
    const rows = db.prepare("SELECT key, value FROM settings WHERE key != 'operator_token'").all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// публічний sse потік для миттєвої синхронізації статусу відчинено / зачинено
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const rows = db.prepare("SELECT key, value FROM settings WHERE key != 'operator_token'").all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  res.write(`data: ${JSON.stringify({ type: 'SETTINGS_UPDATED', data: settings, timestamp: new Date().toISOString() })}\n\n`);

  addGlobalClient(res);
});

module.exports = router;
