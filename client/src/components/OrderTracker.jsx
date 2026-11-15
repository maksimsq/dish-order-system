import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Clock, ChefHat, Check, XCircle, 
  Wifi, WifiOff, AlertTriangle, ArrowLeft 
} from 'lucide-react';
import { createOrderEventSource, testClientStatusAttempt } from '../services/api';

const STATUS_STEPS = [
  { key: 'new', label: 'Отримано', icon: Clock },
  { key: 'cooking', label: 'Готується', icon: ChefHat },
  { key: 'ready', label: 'Готове до видачі', icon: CheckCircle2 },
  { key: 'completed', label: 'Виконано', icon: Check }
];

export default function OrderTracker({ initialOrder, onBackToMenu }) {
  const [order, setOrder] = useState(initialOrder);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!initialOrder?.order_number) return;

    // підключення до sse з автоматичним відновленням стану
    const sub = createOrderEventSource(initialOrder.order_number, {
      onUpdate: (updatedOrder) => {
        setOrder(updatedOrder);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
      onError: (err) => {
        console.warn('sse перервано, спроба відновлення з-єднання', err);
      }
    });

    return () => {
      sub.close();
    };
  }, [initialOrder?.order_number]);

  // тестова спроба клієнта змінити статус замовлення
  const handleClientStatusAttempt = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testClientStatusAttempt(order.order_number);
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const getStepIndex = (status) => {
    if (status === 'cancelled') return -1;
    return STATUS_STEPS.findIndex(s => s.key === status);
  };

  const currentStepIdx = getStepIndex(order.status);

  return (
    <div className="container" style={{ padding: '24px 16px' }}>
      <button 
        className="btn-secondary" 
        onClick={onBackToMenu}
        style={{ marginBottom: '16px' }}
      >
        <ArrowLeft size={16} />
        <span>Повернутися до меню</span>
      </button>

      <div className="tracker-card">
        {/* заголовок та sse індикатор з'єднання */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Замовлення ресторану:</div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{order.order_number}</h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Інтервал отримання: <strong>{order.slot_time}</strong> ({order.delivery_type === 'pickup' ? 'Самовивіз' : 'У закладі'})
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            {/* індикатор стану з'єднання sse */}
            <div className={`connection-pill ${
              connectionStatus === 'connected' ? 'conn-connected' : 
              connectionStatus === 'reconnecting' ? 'conn-reconnecting' : 'conn-error'
            }`}>
              {connectionStatus === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>
                {connectionStatus === 'connected' ? 'живе з-єднання (SSE)' : 
                 connectionStatus === 'reconnecting' ? 'відновлення з-єднання...' : 'офлайн'}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              автоматична синхронізація при відновленні мережі
            </span>
          </div>
        </div>

        {/* візуалізація статусу */}
        {order.status === 'cancelled' ? (
          <div style={{
            background: 'var(--danger-light)',
            color: 'var(--danger)',
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            margin: '24px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontWeight: 700
          }}>
            <XCircle size={24} />
            <span>Це замовлення було скасовано закладом</span>
          </div>
        ) : (
          <div className="timeline">
            {STATUS_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = idx < currentStepIdx;
              const isActive = idx === currentStepIdx;

              return (
                <div 
                  key={step.key} 
                  className={`timeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                >
                  <div className="step-circle">
                    <Icon size={20} />
                  </div>
                  <div className="step-label">{step.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* позиції замовлення */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Склад замовлення:</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {order.items?.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{item.quantity} × {item.dish_name}</span>
                  {item.modifiers?.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      + {item.modifiers.map(m => m.modifier_name).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 700 }}>{item.item_total.toFixed(2)} грн</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', fontWeight: 800, fontSize: '1.15rem' }}>
            <span>Разом:</span>
            <span>{order.total_price.toFixed(2)} грн</span>
          </div>
        </div>

        {/* спеціальний блок перевірки захисту за варіантом 11 методички */}
        <div style={{
          marginTop: '28px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: 'var(--radius-sm)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '6px' }}>
            <AlertTriangle size={16} color="var(--primary)" />
            <span>Перевірка з методички: спроба клієнта встановити статус «виконано»</span>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '10px' }}>
            За правилами курсового проєкту клієнт не має доступу до зміни статусу замовлення. Спробуємо відправити запит без токена оператора.
          </p>

          <button
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            onClick={handleClientStatusAttempt}
            disabled={isTesting}
          >
            {isTesting ? 'Відправка запиту...' : 'Спробувати змінити статус як клієнт'}
          </button>

          {testResult && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              borderRadius: '6px',
              background: testResult.success ? 'var(--success-light)' : 'var(--danger-light)',
              color: testResult.success ? 'var(--success)' : 'var(--danger)',
              fontSize: '0.85rem'
            }}>
              <strong>Результат перевірки: </strong>
              {testResult.error || 'Успіх'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
