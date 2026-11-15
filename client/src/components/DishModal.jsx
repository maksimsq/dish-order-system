import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, Check, Plus, Minus } from 'lucide-react';

export default function DishModal({ dish, onClose, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);
  // обрані модифікатори: { [groupId]: [modId1, modId2] }
  const [selectedMods, setSelectedMods] = useState(() => {
    const initial = {};
    if (dish && dish.modifier_groups) {
      for (const group of dish.modifier_groups) {
        // якщо обов'язковий вибір 1 елемента - обираємо перший за замовчуванням
        if (group.is_required && group.min_selection === 1 && group.modifiers?.length > 0) {
          initial[group.id] = [group.modifiers[0].id];
        } else {
          initial[group.id] = [];
        }
      }
    }
    return initial;
  });

  const [validationError, setValidationError] = useState('');

  // перемикання модифікатора
  const toggleModifier = (group, mod) => {
    setValidationError('');
    const current = selectedMods[group.id] || [];
    const isSelected = current.includes(mod.id);

    if (group.max_selection === 1) {
      // одиничний вибір (радіо-кнопка)
      if (isSelected && !group.is_required) {
        setSelectedMods({ ...selectedMods, [group.id]: [] });
      } else {
        setSelectedMods({ ...selectedMods, [group.id]: [mod.id] });
      }
    } else {
      // множинний вибір
      if (isSelected) {
        setSelectedMods({
          ...selectedMods,
          [group.id]: current.filter(id => id !== mod.id)
        });
      } else {
        if (current.length >= group.max_selection) {
          setValidationError(`у групі "${group.name}" можна обрати максимум ${group.max_selection}`);
          return;
        }
        setSelectedMods({
          ...selectedMods,
          [group.id]: [...current, mod.id]
        });
      }
    }
  };

  // підрахунок вартості однієї порції з урахуванням модифікаторів
  const unitPrice = useMemo(() => {
    let sum = dish.base_price;
    if (dish.modifier_groups) {
      for (const group of dish.modifier_groups) {
        const chosenIds = selectedMods[group.id] || [];
        for (const mod of group.modifiers || []) {
          if (chosenIds.includes(mod.id)) {
            sum += mod.price;
          }
        }
      }
    }
    return sum;
  }, [dish, selectedMods]);

  // перевірка перед додаванням
  const handleAdd = () => {
    // перевіряємо обов'язкові групи
    if (dish.modifier_groups) {
      for (const group of dish.modifier_groups) {
        const count = (selectedMods[group.id] || []).length;
        if (group.is_required && count < group.min_selection) {
          setValidationError(`обов-язково оберіть опцію у групі "${group.name}" (мінімум ${group.min_selection})`);
          return;
        }
        if (count > group.max_selection) {
          setValidationError(`перевищено ліміт у групі "${group.name}" (максимум ${group.max_selection})`);
          return;
        }
      }
    }

    // формуємо плаский масив обраних modId
    const allModIds = [];
    Object.values(selectedMods).forEach(arr => allModIds.push(...arr));

    onAddToCart({
      dish,
      quantity,
      modifierIds: allModIds,
      unitPrice
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{dish.name}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {dish.image_url && (
            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '220px' }}>
              <img 
                src={dish.image_url} 
                alt={dish.name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            </div>
          )}

          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{dish.description}</p>

          {/* блок складу страви */}
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px', color: '#334155' }}>
              Склад страви:
            </div>
            <div style={{ fontSize: '0.88rem', color: '#475569' }}>
              {dish.ingredients}
            </div>
          </div>

          {/* блок навчальної інформації про алергени без медичних рекомендацій */}
          <div className="allergen-box">
            <div className="allergen-box-title">
              <AlertTriangle size={18} />
              <span>Навчальна інформація про алергени:</span>
            </div>
            <div>
              <strong>Виявлені алергени: </strong>{dish.allergens || 'Не виявлено'}
            </div>
            <div className="allergen-disclaimer">
              * Застереження: дані наведено в навчально-ознайомлювальних цілях для курсового проєкту без надання медичних рекомендацій.
            </div>
          </div>

          {/* групи модифікаторів */}
          {dish.modifier_groups && dish.modifier_groups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>Модифікатори та опції:</div>

              {dish.modifier_groups.map(group => {
                const current = selectedMods[group.id] || [];
                return (
                  <div key={group.id} className="mod-group">
                    <div className="mod-group-title">
                      <span>{group.name}</span>
                      <span className="mod-rule-badge">
                        {group.is_required ? `обов-язково ${group.min_selection}` : `до ${group.max_selection}`}
                      </span>
                    </div>

                    <div className="mod-list">
                      {group.modifiers?.map(mod => {
                        const isChecked = current.includes(mod.id);
                        return (
                          <div
                            key={mod.id}
                            className={`mod-item ${isChecked ? 'selected' : ''}`}
                            onClick={() => toggleModifier(group, mod)}
                          >
                            <div className="mod-item-label">
                              <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: group.max_selection === 1 ? '50%' : '4px',
                                border: '2px solid',
                                borderColor: isChecked ? 'var(--primary)' : '#cbd5e1',
                                background: isChecked ? 'var(--primary)' : '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {isChecked && <Check size={12} color="#ffffff" />}
                              </div>
                              <span>{mod.name}</span>
                            </div>

                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: mod.price > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                              {mod.price > 0 ? `+${mod.price} грн` : 'включено'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* валідаційна помилка вибору модифікаторів */}
          {validationError && (
            <div style={{ color: 'var(--danger)', fontSize: '0.88rem', fontWeight: 600 }}>
              * {validationError}
            </div>
          )}

          {/* керування кількістю та додавання до кошика */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                style={{ padding: '8px 12px' }}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={16} />
              </button>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: '24px', textAlign: 'center' }}>
                {quantity}
              </span>
              <button 
                className="btn-secondary" 
                style={{ padding: '8px 12px' }}
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus size={16} />
              </button>
            </div>

            <button 
              className="btn-primary" 
              onClick={handleAdd}
              disabled={dish.is_available !== 1}
            >
              <span>{dish.is_available === 1 ? 'Додати до кошика' : 'Недоступно'}</span>
              <span>•</span>
              <span>{(unitPrice * quantity).toFixed(2)} грн</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
