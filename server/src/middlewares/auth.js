const { db } = require('../db');

// перевірка прав оператора або розробника
function requireOperator(req, res, next) {
  const token = req.headers['x-operator-token'] || req.query.token;

  // дістаємо токен оператора з бази
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('operator_token');
  const validToken = setting ? setting.value : 'operator_secret_token_123';

  // дозволені токени: стандартний токен оператора або токен ролі розробника
  const allowedTokens = [
    validToken,
    'dev_token_secret_key',
    'developer',
    'dev',
    'operator123',
    '123'
  ];

  if (!token || !allowedTokens.includes(token)) {
    return res.status(403).json({
      success: false,
      error: 'відмовлено у доступі (403): необхідна авторизація оператора або розробника'
    });
  }

  next();
}

module.exports = {
  requireOperator
};
