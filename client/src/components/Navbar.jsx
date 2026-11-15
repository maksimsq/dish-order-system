import React from 'react';
import { ShoppingBag, ShieldCheck, Beaker, Utensils, LogOut, User } from 'lucide-react';

export default function Navbar({
  cartCount,
  onOpenCart,
  isOpen,
  activeView,
  setActiveView,
  onOpenTests,
  staffUser,
  onLogoutStaff
}) {
  return (
    <header className="header">
      <div className="container header-inner">
        <div 
          className="logo" 
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveView('menu')}
        >
          <div className="logo-badge">🍕</div>
          <div>
            <div>Смак-Арт</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
              система замовлення страв
            </div>
          </div>
        </div>

        <div className="header-actions">
          {/* статус роботи закладу з миттєвою синхронізацією */}
          <div className={`badge-status ${isOpen ? 'badge-open' : 'badge-closed'}`}>
            <span className="status-dot"></span>
            <span>{isOpen ? 'заклад відчинено' : 'заклад зачинено'}</span>
          </div>

          {/* кнопки навігації */}
          <button 
            className={`btn-secondary ${activeView === 'menu' ? 'active' : ''}`}
            onClick={() => setActiveView('menu')}
          >
            <Utensils size={16} />
            <span className="hide-mobile">Меню</span>
          </button>

          {/* панель оператора / авторизація */}
          {staffUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button 
                className={`btn-secondary ${activeView === 'operator' ? 'active' : ''}`}
                onClick={() => setActiveView('operator')}
              >
                <ShieldCheck size={16} />
                <span className="hide-mobile">
                  {staffUser.role === 'developer' ? 'Панель Dev' : 'Панель оператора'}
                </span>
              </button>
              <button 
                className="btn-secondary"
                style={{ padding: '8px 10px' }}
                onClick={onLogoutStaff}
                title="Вийти з панелі"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button 
              className={`btn-secondary ${activeView === 'operator' ? 'active' : ''}`}
              onClick={() => setActiveView('operator')}
            >
              <ShieldCheck size={16} />
              <span className="hide-mobile">Вхід оператора / Dev</span>
            </button>
          )}

          {/* кнопка лабораторних перевірок для викладача */}
          <button 
            className="btn-secondary"
            onClick={onOpenTests}
            title="демонстрація обов-язкових вимог варіанта 11"
          >
            <Beaker size={16} />
            <span className="hide-mobile">Тести варіанта 11</span>
          </button>

          {/* кнопка кошика */}
          <button className="cart-btn" onClick={onOpenCart}>
            <ShoppingBag size={18} />
            <span>Кошик</span>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}
