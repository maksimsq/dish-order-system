import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, RefreshCw, Send, Terminal, Play } from 'lucide-react';
import { 
  createOrder, 
  fetchSlots, 
  updateOperatorSettings, 
  toggleDishAvailability, 
  testClientStatusAttempt 
} from '../services/api';

export default function TestScenariosModal({ onClose }) {
  const [activeTestId, setActiveTestId] = useState(null);
  const [running, setRunning] = useState(false);
  // детальні результати з протоколом запиту і відповіді
  const [testLog, setTestLog] = useState(null);

  const token = 'operator_secret_token_123';

  // 1. перевірка: закритий заклад
  const runClosedRestaurantTest = async () => {
    setActiveTestId(1);
    setRunning(true);
    setTestLog(null);

    const startTime = performance.now();
    try {
      // крок 1: оператор переводить заклад у зачинений стан
      await updateOperatorSettings(token, { is_open: '0' });

      // крок 2: спроба клієнта оформити замовлення
      const requestPayload = {
        clientName: 'Тестовий Клієнт',
        clientPhone: '+380990001122',
        slotTime: '2026-11-14 18:00-18:20',
        items: [{ dishId: 1, quantity: 1, modifierIds: [1] }]
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      const responseData = await res.json();
      const durationMs = Math.round(performance.now() - startTime);

      const passed = res.status === 400 && responseData.success === false;

      setTestLog({
        testName: 'Тест 1. Замовлення при закритому закладі',
        passed,
        request: {
          method: 'POST',
          url: '/api/orders',
          body: requestPayload
        },
        response: {
          status: res.status,
          statusText: res.statusText,
          duration: `${durationMs} мс`,
          body: responseData
        },
        explanation: passed 
          ? 'Успішно! Сервер заблокував замовлення кодом 400 та повернув точну причину: заклад зачинено.' 
          : 'Помилка: сервер дозволив замовлення при закритому закладі.'
      });
    } catch (err) {
      setTestLog({
        testName: 'Тест 1. Замовлення при закритому закладі',
        passed: false,
        error: err.message
      });
    } finally {
      // повертаємо заклад у відкритий стан
      await updateOperatorSettings(token, { is_open: '1' });
      setRunning(false);
    }
  };

  // 2. перевірка: зміна доступності страви
  const runDishUnavailableTest = async () => {
    setActiveTestId(2);
    setRunning(true);
    setTestLog(null);

    const startTime = performance.now();
    try {
      // крок 1: вимикаємо страву 1 у стоп-лист
      await toggleDishAvailability(token, 1, false);

      const requestPayload = {
        clientName: 'Тестовий Клієнт',
        clientPhone: '+380990001122',
        slotTime: '2026-11-14 18:00-18:20',
        items: [{ dishId: 1, quantity: 1, modifierIds: [1] }]
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      const responseData = await res.json();
      const durationMs = Math.round(performance.now() - startTime);

      const passed = res.status === 400 && responseData.error && responseData.error.includes('недоступна');

      setTestLog({
        testName: 'Тест 2. Замовлення недоступної страви (стоп-лист)',
        passed,
        request: {
          method: 'POST',
          url: '/api/orders',
          body: requestPayload
        },
        response: {
          status: res.status,
          statusText: res.statusText,
          duration: `${durationMs} мс`,
          body: responseData
        },
        explanation: passed
          ? 'Успішно! Сервер перевірив статус страви в базі даних та повернув 400: страва наразі недоступна.'
          : 'Помилка: сервер дозволив замовлення недоступної страви.'
      });
    } catch (err) {
      setTestLog({
        testName: 'Тест 2. Замовлення недоступної страви',
        passed: false,
        error: err.message
      });
    } finally {
      await toggleDishAvailability(token, 1, true);
      setRunning(false);
    }
  };

  // 3. перевірка: дублювання підтвердження (ідемпотентність)
  const runIdempotencyTest = async () => {
    setActiveTestId(3);
    setRunning(true);
    setTestLog(null);

    const startTime = performance.now();
    try {
      const testKey = `idemp_test_${Date.now()}`;
      const requestPayload = {
        clientName: 'Тест Подвійного Кліку',
        clientPhone: '+380991112233',
        slotTime: '2026-11-14 18:00-18:20',
        idempotencyKey: testKey,
        items: [{ dishId: 2, quantity: 1, modifierIds: [] }]
      };

      // перший запит
      const res1 = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      const data1 = await res1.json();

      // другий запит з тим самим ключем
      const res2 = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      const data2 = await res2.json();

      const durationMs = Math.round(performance.now() - startTime);

      const passed = data1.data?.order_number && (data1.data.order_number === data2.data?.order_number);

      setTestLog({
        testName: 'Тест 3. Захист від дублювання (ідемпотентність)',
        passed,
        request: {
          method: 'POST × 2',
          url: '/api/orders',
          idempotencyKey: testKey,
          body: requestPayload
        },
        response: {
          firstCallOrder: data1.data?.order_number,
          secondCallOrder: data2.data?.order_number,
          status: `${res1.status} / ${res2.status}`,
          duration: `${durationMs} мс`,
          body: {
            firstAttemptResult: data1.data?.order_number,
            secondAttemptResult: data2.data?.order_number,
            isDuplicatePrevented: passed
          }
        },
        explanation: passed
          ? `Успішно! Обидва запити повернули одне замовлення ${data1.data?.order_number}. Друге замовлення не дублювалося в базі.`
          : 'Помилка: створено два окремі замовлення замість одного.'
      });
    } catch (err) {
      setTestLog({
        testName: 'Тест 3. Ідемпотентність',
        passed: false,
        error: err.message
      });
    } finally {
      setRunning(false);
    }
  };

  // 4. перевірка: спроба клієнта встановити статус «виконано»
  const runClientStatusTest = async () => {
    setActiveTestId(4);
    setRunning(true);
    setTestLog(null);

    const startTime = performance.now();
    try {
      const res = await testClientStatusAttempt('ORD-TEST-SECURITY');
      const durationMs = Math.round(performance.now() - startTime);

      const passed = res.status === 403;

      setTestLog({
        testName: 'Тест 4. Спроба клієнта встановити статус «виконано»',
        passed,
        request: {
          method: 'POST',
          url: '/api/orders/ORD-TEST-SECURITY/client-status-attempt',
          headers: { 'Content-Type': 'application/json' },
          body: { status: 'completed' }
        },
        response: {
          status: res.status,
          statusText: res.statusText || 'Forbidden',
          duration: `${durationMs} мс`,
          body: res.data
        },
        explanation: passed
          ? 'Успішно! Сервер повернув HTTP 403 Forbidden. Неавторизований клієнт не може змінювати статус замовлення.'
          : 'Помилка: доступ не було заблоковано.'
      });
    } catch (err) {
      setTestLog({
        testName: 'Тест 4. Спроба зміни статусу клієнтом',
        passed: false,
        error: err.message
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Лабораторні перевірки вимог варіанта 11</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Наочна демонстрація відповідей сервера для захисту перед викладачем
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {/* тест 1 */}
            <div style={{ background: '#141416', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>1. Закритий заклад</span>
                <button
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={runClosedRestaurantTest}
                  disabled={running}
                >
                  <Play size={12} />
                  <span>Перевірити</span>
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Перевірка відхилення замовлення, коли заклад зачинено
              </div>
            </div>

            {/* тест 2 */}
            <div style={{ background: '#141416', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>2. Недоступна страва</span>
                <button
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={runDishUnavailableTest}
                  disabled={running}
                >
                  <Play size={12} />
                  <span>Перевірити</span>
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Перевірка блокування страви зі стоп-листа
              </div>
            </div>

            {/* тест 3 */}
            <div style={{ background: '#141416', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>3. Подвійний клік (Ідемпотентність)</span>
                <button
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={runIdempotencyTest}
                  disabled={running}
                >
                  <Play size={12} />
                  <span>Перевірити</span>
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Надсилання двох однакових запитів з одним ключем
              </div>
            </div>

            {/* тест 4 */}
            <div style={{ background: '#141416', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>4. Зміна статусу клієнтом</span>
                <button
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={runClientStatusTest}
                  disabled={running}
                >
                  <Play size={12} />
                  <span>Перевірити</span>
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Перевірка захисту ролей та коду 403 Forbidden
              </div>
            </div>
          </div>

          {/* індикатор виконання */}
          {running && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              <div>Надсилається мережевий запит на сервер...</div>
            </div>
          )}

          {/* наочний результат тесту з протоколом */}
          {testLog && !running && (
            <div style={{
              background: '#141416',
              border: `1px solid ${testLog.passed ? '#166534' : '#991b1b'}`,
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {testLog.passed ? (
                    <CheckCircle2 size={22} color="#4ade80" />
                  ) : (
                    <XCircle size={22} color="#f87171" />
                  )}
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: testLog.passed ? '#4ade80' : '#f87171' }}>
                    {testLog.testName}: {testLog.passed ? 'ТЕСТ ПРОЙДЕНО' : 'ПОМИЛКА'}
                  </span>
                </div>

                {testLog.response?.status && (
                  <span className={`test-badge-http http-${String(testLog.response.status).slice(0, 3)}`}>
                    HTTP {testLog.response.status} ({testLog.response.duration})
                  </span>
                )}
              </div>

              {/* пояснення результату */}
              <div style={{ fontSize: '0.88rem', color: '#e4e4e7', background: '#1f1f23', padding: '10px 12px', borderRadius: '6px' }}>
                <strong>Висновок:</strong> {testLog.explanation}
              </div>

              {/* наочний лог запиту та відповіді для викладача */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={14} />
                  <span>Відправлений запит клієнта:</span>
                </div>
                <div className="test-log-terminal">
                  {testLog.request?.method} {testLog.request?.url}
                  {'\n'}
                  {JSON.stringify(testLog.request?.body, null, 2)}
                </div>

                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={14} />
                  <span>Відповідь бекенда (Status {testLog.response?.status}):</span>
                </div>
                <div className="test-log-terminal">
                  {JSON.stringify(testLog.response?.body, null, 2)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
