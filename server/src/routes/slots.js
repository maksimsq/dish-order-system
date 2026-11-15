const express = require('express');
const router = express.Router();
const { getAvailableSlots } = require('../services/slotService');

// отримання доступних часових інтервалів
router.get('/', (req, res) => {
  try {
    const { date } = req.query;
    const slots = getAvailableSlots(date);
    res.json({
      success: true,
      data: slots
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
