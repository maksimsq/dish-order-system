const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const { initDatabase } = require('./db');

const menuRoutes = require('./routes/menu');
const slotsRoutes = require('./routes/slots');
const settingsRoutes = require('./routes/settings');
const ordersRoutes = require('./routes/orders');
const operatorRoutes = require('./routes/operator');

const app = express();
const PORT = process.env.PORT || 5000;

// налаштування middleware
app.use(cors());
app.use(express.json());

// ініціалізація бази даних та початкових даних
initDatabase();

// реєстрація маршрутів api
app.use('/api/menu', menuRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/operator', operatorRoutes);

// базовий статус бекенду
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// роздача зібраного клієнтського інтерфейсу (якщо зібрано)
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// запуск сервера
app.listen(PORT, () => {
  console.log(`сервер ресторану успішно запущено на порті ${PORT}`);
});
