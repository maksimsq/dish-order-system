import React, { useState, useEffect } from 'react';
import { X, Trash2, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { fetchSlots, createOrder } from '../services/api';

export default function CartDrawer({
  cart,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess
}) {
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('+380');
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // унікальний ключ для захисту від дублювання
  const [idempotencyKey] = useState(() => `cart_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // завантаження слотів
  useEffect(() => {
    async function loadSlots() {
      setLoadingSlots(true);
      try {
        const data = await fetchSlots();
        setSlots(data);
        // автоматично вибираємо перший вільний слот
        const firstAvailable = data.find(s => s.is_available);
        if (firstAvailable) {
          setSelectedSlot(firstAvailable.slot_key);
        }
      } catch (err) {
        console.error('помилка завантаження інтервалів', err);
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, []);

  // клієнтська сума для відображення
  const totalAmount = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);

  // оформлення замовлення
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage('кошик порожній');
      return;
    }

    if (!selectedSlot) {
      setErrorMessage('будь ласка, оберіть інтервал отримання замовлення');
      return;
    }

    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMessage('будь ласка, вкажіть ваше ім-я та номер телефону');
      return;
    }

    setSubmitting(true);

    try {
      // формуємо запит на сервер з id страв та модифікаторами
      const payload = {
        clientName,
        clientPhone,
        deliveryType,
        slotTime: selectedSlot,
        notes,
        idempotencyKey,
        items: cart.map(item => ({
          dishId: item.dish.id,
          quantity: item.quantity,
          modifierIds: item.modifierIds
        }))
      };

      const newOrder = await createOrder(payload);
      onClearCart();
      onClose();
      onOrderSuccess(newOrder);
    } catch (err) {
      setErrorMessage(err.message || 'помилка при оформленні замовлення');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Кошик замовлення</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({cart.length} поз.)</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="drawer-body">
          {errorMessage && (
            <div style={{
              background: 'var(--danger-light)',
              color: 'var(--danger)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.88rem',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛒</div>
              <p style={{ fontWeight: 600 }}>Ваш кошик наразі порожній</p>
              <p style={{ fontSize: '0.85rem' }}>Оберіть смачні страви з меню ресторану</p>
            </div>
          ) : (
            <>
              {/* список вибраних страв */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: '#ffffff'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        {item.dish.name}
                      </div>
                      <button 
                        onClick={() => onRemoveItem(idx)}
                        style={{ color: '#9ca3af', padding: '4px' }}
                        title="Видалити"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* обрані модифікатори під назвою */}
                    {item.modifierIds && item.modifierIds.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0' }}>
                        {item.dish.modifier_groups?.flatMap(g => 
                          (g.modifiers || []).filter(m => item.modifierIds.includes(m.id)).map(m => m.name)
                        ).join(', ')}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          onClick={() => onUpdateQuantity(idx, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.quantity}</span>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          onClick={() => onUpdateQuantity(idx, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                        {(item.unitPrice * item.quantity).toFixed(2)} грн
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* вибір способу отримання */}
              <div style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                  Спосіб отримання:
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn-secondary ${deliveryType === 'pickup' ? 'active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center', borderColor: deliveryType === 'pickup' ? 'var(--primary)' : 'var(--border-color)', background: deliveryType === 'pickup' ? 'var(--primary-light)' : '#f9fafb' }}
                    onClick={() => setDeliveryType('pickup')}
                  >
                    Самовивіз
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary ${deliveryType === 'dine_in' ? 'active' : ''}`}
                    style={{ flex: 1, justifyContent: 'center', borderColor: deliveryType === 'dine_in' ? 'var(--primary)' : 'var(--border-color)', background: deliveryType === 'dine_in' ? 'var(--primary-light)' : '#f9fafb' }}
                    onClick={() => setDeliveryType('dine_in')}
                  >
                    У закладі
                  </button>
                </div>
              </div>

              {/* часові слоти з пропускною здатністю */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                    Інтервал отримання:
                  </label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ліміт замовлень на слот
                  </span>
                </div>

                {loadingSlots ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                    <Loader size={20} className="animate-spin" />
                  </div>
                ) : (
                  <div className="slots-container">
                    {slots.map(slot => {
                      const isSelected = selectedSlot === slot.slot_key;
                      return (
                        <div
                          key={slot.slot_key}
                          className={`slot-card ${isSelected ? 'selected' : ''} ${!slot.is_available ? 'disabled' : ''}`}
                          onClick={() => {
                            if (slot.is_available) {
                              setSelectedSlot(slot.slot_key);
                            }
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{slot.time_range}</div>
                          <div style={{ fontSize: '0.72rem', marginTop: '2px', opacity: 0.85 }}>
                            {slot.is_past ? 'минув' : slot.is_full ? 'заповнено' : `вільно ${slot.max_orders - slot.current_orders}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* дані клієнта */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Ваше ім-я:
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="Наприклад: Олексій"
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Номер телефону:
                  </label>
                  <input
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    placeholder="+380991234567"
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Коментар до замовлення:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Побажання щодо упакування тощо"
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="drawer-footer">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Разом до сплати:</div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>* остаточний розрахунок на сервері</div>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                {totalAmount.toFixed(2)} грн
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Обробка замовлення...' : 'Підтвердити замовлення'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
