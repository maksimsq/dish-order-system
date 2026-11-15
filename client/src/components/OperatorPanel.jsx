import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, RefreshCw, Power, Lock, User, 
  CheckCircle, Clock, ChefHat, XCircle, LogOut, Code, AlertCircle 
} from 'lucide-react';
import { 
  fetchOperatorOrders, updateOrderStatus, toggleDishAvailability,
  fetchOperatorSettings, updateOperatorSettings, fetchMenu,
  createOperatorEventSource, loginStaff
} from '../services/api';

export default function OperatorPanel({ 
  staffUser, 
  onLoginSuccess, 
  onLogout, 
  onSettingsUpdated,
  onBackToMenu 
}) {
  // поля форми авторизації
  const [loginRole, setLoginRole] = useState('developer'); // 'developer' | 'operator'
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // стан панелі
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [settings, setSettings] = useState({ is_open: '1', max_orders_per_slot: '3' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // обробка входу
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoggingIn(true);

    try {
      const data = await loginStaff(loginRole, password);
      onLoginSuccess(data);
    } catch (err) {
      setAuthError(err.message || 'невірний пароль');
    } finally {
      setLoggingIn(false);
    }
  };

  // завантаження даних для авторизованого персоналу
  const loadData = async () => {
    if (!staffUser) return;
    setLoading(true);
    try {
      const [ordersData, menuData, settingsData] = await Promise.all([
        fetchOperatorOrders(staffUser.token, statusFilter),
        fetchMenu(),
        fetchOperatorSettings(staffUser.token)
      ]);
      setOrders(ordersData);
      setMenu(menuData);
      setSettings(settingsData);
    } catch (err) {
      console.error('помилка завантаження даних оператора', err);
      showToast('помилка доступу, будь ласка, увійдіть повторно');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (staffUser) {
      loadData();

      // підключення до операторського sse стріму для миттєвих сповіщень
      const es = createOperatorEventSource(staffUser.token, {
        onEvent: (payload) => {
          if (payload.type === 'NEW_ORDER' || payload.type === 'ORDER_UPDATED') {
            loadData();
            showToast(`Оновлення: замовлення ${payload.data?.order_number || ''}`);
          }
        }
      });

      return () => es.close();
    }
  }, [staffUser, statusFilter]);

  // зміна статусу замовлення
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(staffUser.token, orderId, newStatus);
      showToast(`статус замовлення змінено на "${newStatus}"`);
      loadData();
    } catch (err) {
      showToast(err.message || 'помилка зміни статусу');
    }
  };

  // перемикання доступності страви
  const handleToggleDish = async (dishId, currentAvailability) => {
    try {
      await toggleDishAvailability(staffUser.token, dishId, !currentAvailability);
      showToast('доступність страви успішно змінено');
      const updatedMenu = await fetchMenu();
      setMenu(updatedMenu);
    } catch (err) {
      showToast(err.message || 'помилка зміни доступності');
    }
  };

  // перемикання статусу закладу з миттєвим оновленням на сайті
  const handleToggleRestaurant = async () => {
    try {
      const nextOpen = settings.is_open === '1' ? '0' : '1';
      await updateOperatorSettings(staffUser.token, { is_open: nextOpen });
      const newSettings = { ...settings, is_open: nextOpen };
      setSettings(newSettings);
      if (onSettingsUpdated) {
        onSettingsUpdated(newSettings);
      }
      showToast(nextOpen === '1' ? 'заклад відчинено для замовлень' : 'заклад зачинено');
    } catch (err) {
      showToast(err.message || 'помилка оновлення налаштувань');
    }
  };

  // зміна ліміту замовлень на слот
  const handleUpdateSlotCapacity = async (newVal) => {
    try {
      await updateOperatorSettings(staffUser.token, { max_orders_per_slot: String(newVal) });
      const newSettings = { ...settings, max_orders_per_slot: String(newVal) };
      setSettings(newSettings);
      if (onSettingsUpdated) {
        onSettingsUpdated(newSettings);
      }
      showToast(`ліміт слоту оновлено: ${newVal} замовлень`);
    } catch (err) {
      showToast(err.message || 'помилка зміни ліміту');
    }
  };

  // якщо користувач не увійшов - форма входу
  if (!staffUser) {
    return (
      <div className="container" style={{ padding: '48px 16px', maxWidth: '440px' }}>
        <div style={{
          background: '#1a1a1e',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 28px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: '#27272a',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              border: '1px solid #3f3f46'
            }}>
              <Lock size={22} color="var(--primary)" />
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Авторизація персоналу</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Вхід для ролей оператора та розробника
            </p>
          </div>

          {authError && (
            <div style={{
              background: 'var(--danger-bg)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              marginBottom: '16px',
              border: '1px solid #7f1d1d'
            }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Оберіть роль для входу:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`btn-secondary ${loginRole === 'developer' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    setLoginRole('developer');
                    setPassword('');
                    setAuthError('');
                  }}
                >
                  <Code size={16} />
                  <span>Developer</span>
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${loginRole === 'operator' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    setLoginRole('operator');
                    setPassword('');
                    setAuthError('');
                  }}
                >
                  <User size={16} />
                  <span>Operator</span>
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Пароль доступу:
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Введіть пароль"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
              disabled={loggingIn}
            >
              {loggingIn ? 'Авторизація...' : 'Увійти в панель'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '24px 16px' }}>
      {/* верхня панель оператора */}
      <div style={{
        background: '#1a1a1e',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#27272a', padding: '10px', borderRadius: '10px', border: '1px solid #3f3f46' }}>
            {staffUser.role === 'developer' ? <Code size={26} color="var(--primary)" /> : <ShieldCheck size={26} color="var(--primary)" />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                {staffUser.role === 'developer' ? 'Панель керування (Developer)' : 'Панель оператора закладу'}
              </h1>
              <span style={{
                background: staffUser.role === 'developer' ? '#312e81' : '#14532d',
                color: staffUser.role === 'developer' ? '#c7d2fe' : '#86efac',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                {staffUser.role}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Користувач: {staffUser.name}
            </p>
          </div>
        </div>

        {/* керування станом закладу */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Режим:</span>
            <button
              className="btn-secondary"
              style={{
                background: settings.is_open === '1' ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: settings.is_open === '1' ? '#4ade80' : '#f87171',
                borderColor: settings.is_open === '1' ? '#166534' : '#991b1b',
                padding: '8px 12px'
              }}
              onClick={handleToggleRestaurant}
            >
              <Power size={14} />
              <span>{settings.is_open === '1' ? 'Заклад відчинено' : 'Заклад зачинено'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Ліміт слоту:</span>
            <select
              value={settings.max_orders_per_slot || '3'}
              onChange={e => handleUpdateSlotCapacity(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.85rem' }}
            >
              <option value="1">1 зам. / слот</option>
              <option value="2">2 зам. / слот</option>
              <option value="3">3 зам. / слот</option>
              <option value="5">5 зам. / слот</option>
            </select>
          </div>

          <button className="btn-secondary" onClick={loadData} title="Оновити дані">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Оновити</span>
          </button>

          <button 
            className="btn-secondary" 
            onClick={onLogout}
            style={{ color: '#fca5a5', borderColor: '#7f1d1d' }}
          >
            <LogOut size={14} />
            <span>Вийти</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div style={{
          background: '#27272a',
          color: '#ffffff',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          fontWeight: 600,
          fontSize: '0.88rem',
          border: '1px solid #3f3f46'
        }}>
          🔔 {toastMessage}
        </div>
      )}

      {/* секція 1: стоп-лист страв */}
      <div style={{
        background: '#1a1a1e',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>
          Керування доступністю страв (Стоп-лист кухні)
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Вимкнена страва миттєво стає недоступною для клієнтів (перевіряється як на клієнті, так і бекендом).
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '12px'
        }}>
          {menu.flatMap(cat => cat.dishes || []).map(dish => (
            <div
              key={dish.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: dish.is_available ? '#222227' : '#2b1414'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{dish.name}</div>
                <div style={{ fontSize: '0.75rem', color: dish.is_available ? '#4ade80' : '#f87171' }}>
                  {dish.is_available ? '● доступна' : '✕ у стоп-листі'}
                </div>
              </div>

              <button
                className="btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                onClick={() => handleToggleDish(dish.id, dish.is_available)}
              >
                {dish.is_available ? 'Вимкнути' : 'Увімкнути'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* секція 2: список замовлень */}
      <div style={{
        background: '#1a1a1e',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Список замовлень</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Оновлюється автоматично в реальному часі через Server-Sent Events
            </p>
          </div>

          {/* фільтр статусів */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['all', 'new', 'cooking', 'ready', 'completed', 'cancelled'].map(st => (
              <button
                key={st}
                className={`category-tab ${statusFilter === st ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'all' ? 'Всі' : 
                 st === 'new' ? 'Нові' : 
                 st === 'cooking' ? 'Готуються' : 
                 st === 'ready' ? 'Готові' : 
                 st === 'completed' ? 'Виконані' : 'Скасовані'}
              </button>
            ))}
          </div>
        </div>

        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            Немає замовлень за обраним фільтром
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {orders.map(order => (
              <div
                key={order.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  background: '#222227'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{order.order_number}</span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: order.status === 'new' ? '#3d280b' :
                                    order.status === 'cooking' ? '#172554' :
                                    order.status === 'ready' ? '#14532d' :
                                    order.status === 'completed' ? '#27272a' : '#450a0a',
                        color: order.status === 'new' ? '#fde047' :
                               order.status === 'cooking' ? '#93c5fd' :
                               order.status === 'ready' ? '#86efac' :
                               order.status === 'completed' ? '#d4d4d8' : '#fca5a5'
                      }}>
                        {order.status === 'new' ? 'Нове' :
                         order.status === 'cooking' ? 'Готується' :
                         order.status === 'ready' ? 'Готове' :
                         order.status === 'completed' ? 'Виконано' : 'Скасовано'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Клієнт: <strong>{order.client_name}</strong> ({order.client_phone}) • Інтервал: <strong>{order.slot_time}</strong>
                    </div>
                  </div>

                  <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                    {order.total_price.toFixed(2)} грн
                  </div>
                </div>

                <div style={{ margin: '12px 0', padding: '10px 14px', background: '#18181b', borderRadius: 'var(--radius-sm)', border: '1px solid #27272a' }}>
                  {order.items?.map((it, idx) => (
                    <div key={idx} style={{ fontSize: '0.85rem', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 600 }}>{it.quantity} × {it.dish_name}</span>
                      {it.modifiers?.length > 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {' '}({it.modifiers.map(m => m.modifier_name).join(', ')})
                        </span>
                      )}
                    </div>
                  ))}
                  {order.notes && (
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '6px' }}>
                      Коментар: {order.notes}
                    </div>
                  )}
                </div>

                {/* кнопки керування статусом */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {order.status === 'new' && (
                    <button
                      className="btn-primary"
                      style={{ padding: '7px 12px', fontSize: '0.82rem' }}
                      onClick={() => handleStatusChange(order.id, 'cooking')}
                    >
                      <ChefHat size={14} />
                      <span>Взяти в роботу (Готувати)</span>
                    </button>
                  )}

                  {order.status === 'cooking' && (
                    <button
                      className="btn-secondary"
                      style={{ background: '#14532d', color: '#86efac', borderColor: '#166534', padding: '7px 12px', fontSize: '0.82rem' }}
                      onClick={() => handleStatusChange(order.id, 'ready')}
                    >
                      <CheckCircle size={14} />
                      <span>Позначити готовим</span>
                    </button>
                  )}

                  {order.status === 'ready' && (
                    <button
                      className="btn-secondary"
                      style={{ background: '#27272a', color: '#ffffff', padding: '7px 12px', fontSize: '0.82rem' }}
                      onClick={() => handleStatusChange(order.id, 'completed')}
                    >
                      <span>Видати замовлення (Виконано)</span>
                    </button>
                  )}

                  {order.status !== 'completed' && order.status !== 'cancelled' && (
                    <button
                      className="btn-secondary"
                      style={{ color: '#fca5a5', borderColor: '#7f1d1d', padding: '7px 12px', fontSize: '0.82rem' }}
                      onClick={() => handleStatusChange(order.id, 'cancelled')}
                    >
                      <XCircle size={14} />
                      <span>Скасувати</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
