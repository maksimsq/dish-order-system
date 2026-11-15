// базові запити до api сервера
const API_BASE = '/api';

export async function fetchMenu() {
  const res = await fetch(`${API_BASE}/menu`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function fetchSlots(date) {
  const url = date ? `${API_BASE}/slots?date=${date}` : `${API_BASE}/slots`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// глобальна підписка на статус закладу та налаштування через sse
export function subscribeToGlobalSettings(onUpdate) {
  let es = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    es = new EventSource(`${API_BASE}/settings/events`);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'SETTINGS_UPDATED' && payload.data && onUpdate) {
          onUpdate(payload.data);
        }
      } catch (e) {
        console.error('помилка обробки події налаштувань', e);
      }
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => {
        if (!isClosed) connect();
      }, 3000);
    };
  }

  connect();

  return {
    close: () => {
      isClosed = true;
      if (es) es.close();
    }
  };
}

// попередня калькуляція замовлення на сервері
export async function calculateOrder(items, slotTime) {
  const res = await fetch(`${API_BASE}/orders/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, slotTime })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// оформлення замовлення
export async function createOrder(payload) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// отримання стану замовлення
export async function fetchOrder(orderNumber) {
  const res = await fetch(`${API_BASE}/orders/${orderNumber}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// підключення до sse з автоматичним відновленням
export function createOrderEventSource(orderNumber, { onUpdate, onStatusChange, onError }) {
  let eventSource = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    if (onStatusChange) onStatusChange('connecting');

    eventSource = new EventSource(`${API_BASE}/orders/${orderNumber}/events`);

    eventSource.onopen = () => {
      if (onStatusChange) onStatusChange('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.data && onUpdate) {
          onUpdate(payload.data);
        }
      } catch (e) {
        console.error('помилка обробки події sse', e);
      }
    };

    eventSource.onerror = (err) => {
      if (onStatusChange) onStatusChange('reconnecting');
      if (onError) onError(err);
      eventSource.close();

      fetchOrder(orderNumber)
        .then(freshOrder => {
          if (onUpdate) onUpdate(freshOrder);
        })
        .catch(console.error);

      setTimeout(() => {
        if (!isClosed) connect();
      }, 3000);
    };
  }

  connect();

  return {
    close: () => {
      isClosed = true;
      if (eventSource) eventSource.close();
      if (onStatusChange) onStatusChange('disconnected');
    }
  };
}

// авторизація персоналу (developer / operator)
export async function loginStaff(username, password) {
  const res = await fetch(`${API_BASE}/operator/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

// тестова спроба клієнта змінити статус замовлення
export async function testClientStatusAttempt(orderNumber) {
  const res = await fetch(`${API_BASE}/orders/${orderNumber}/client-status-attempt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' })
  });
  const data = await res.json();
  return {
    status: res.status,
    statusText: res.statusText,
    data
  };
}

// api оператора
export async function fetchOperatorOrders(token, status = 'all') {
  const res = await fetch(`${API_BASE}/operator/orders?status=${status}`, {
    headers: { 'x-operator-token': token }
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updateOrderStatus(token, orderId, status) {
  const res = await fetch(`${API_BASE}/operator/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-operator-token': token
    },
    body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function toggleDishAvailability(token, dishId, isAvailable) {
  const res = await fetch(`${API_BASE}/operator/dishes/${dishId}/availability`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-operator-token': token
    },
    body: JSON.stringify({ is_available: isAvailable })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function fetchOperatorSettings(token) {
  const res = await fetch(`${API_BASE}/operator/settings`, {
    headers: { 'x-operator-token': token }
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updateOperatorSettings(token, settings) {
  const res = await fetch(`${API_BASE}/operator/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-operator-token': token
    },
    body: JSON.stringify(settings)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// sse для панелі оператора
export function createOperatorEventSource(token, { onEvent, onStatusChange }) {
  let es = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    if (onStatusChange) onStatusChange('connecting');

    es = new EventSource(`${API_BASE}/operator/events?token=${token}`);

    es.onopen = () => {
      if (onStatusChange) onStatusChange('connected');
    };

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (onEvent) onEvent(payload);
      } catch (e) {
        console.error('помилка обробки події оператора', e);
      }
    };

    es.onerror = () => {
      if (onStatusChange) onStatusChange('reconnecting');
      es.close();
      setTimeout(() => {
        if (!isClosed) connect();
      }, 3000);
    };
  }

  connect();

  return {
    close: () => {
      isClosed = true;
      if (es) es.close();
    }
  };
}
