// збереження активних клієнтських, системних та операторських sse підключень
const orderClients = new Map(); // orderNumber -> Set of response objects
const operatorClients = new Set(); // Set of response objects
const globalClients = new Set(); // Set of public client response objects

// реєстрація клієнта для відстеження конкретного замовлення
function addOrderClient(orderNumber, res) {
  if (!orderClients.has(orderNumber)) {
    orderClients.set(orderNumber, new Set());
  }
  orderClients.get(orderNumber).add(res);

  res.on('close', () => {
    const clients = orderClients.get(orderNumber);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        orderClients.delete(orderNumber);
      }
    }
  });
}

// реєстрація публічного клієнта для синхронізації статусу закладу
function addGlobalClient(res) {
  globalClients.add(res);
  res.on('close', () => {
    globalClients.delete(res);
  });
}

// реєстрація оператора для отримання всіх подій
function addOperatorClient(res) {
  operatorClients.add(res);
  res.on('close', () => {
    operatorClients.delete(res);
  });
}

// сповіщення клієнта про зміну статусу замовлення
function notifyOrderStatusChange(orderNumber, orderData) {
  const clients = orderClients.get(orderNumber);
  if (clients) {
    const payload = JSON.stringify({
      type: 'STATUS_UPDATE',
      data: orderData,
      timestamp: new Date().toISOString()
    });

    for (const res of clients) {
      res.write(`data: ${payload}\n\n`);
    }
  }

  // також сповіщаємо операторів
  notifyOperators('ORDER_UPDATED', orderData);
}

// сповіщення операторської панелі та публічних клієнтів
function notifyOperators(type, data) {
  const payload = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  });

  for (const res of operatorClients) {
    res.write(`data: ${payload}\n\n`);
  }

  // якщо це оновлення налаштувань або доступності страв - надсилаємо і звичайним відвідувачам
  if (type === 'SETTINGS_UPDATED' || type === 'DISH_AVAILABILITY_CHANGED') {
    for (const res of globalClients) {
      res.write(`data: ${payload}\n\n`);
    }
  }
}

module.exports = {
  addOrderClient,
  addGlobalClient,
  addOperatorClient,
  notifyOrderStatusChange,
  notifyOperators
};
