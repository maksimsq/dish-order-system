import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DishModal from './components/DishModal';
import CartDrawer from './components/CartDrawer';
import OrderTracker from './components/OrderTracker';
import OperatorPanel from './components/OperatorPanel';
import TestScenariosModal from './components/TestScenariosModal';
import { fetchMenu, fetchSettings, subscribeToGlobalSettings } from './services/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [menu, setMenu] = useState([]);
  const [settings, setSettings] = useState({ is_open: '1' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // фільтр категорій: 'all' або id категорії
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDish, setSelectedDish] = useState(null);

  // авторизований персонал: { token, role, name }
  const [staffUser, setStaffUser] = useState(() => {
    try {
      const saved = localStorage.getItem('foodcraft_staff_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // кошик замовлення
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('foodcraft_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeView, setActiveView] = useState('menu'); // 'menu' | 'operator' | 'tracker'
  const [currentOrder, setCurrentOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('foodcraft_last_order');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // збереження кошика
  useEffect(() => {
    localStorage.setItem('foodcraft_cart', JSON.stringify(cart));
  }, [cart]);

  // завантаження початкових даних та меню
  const loadInitialData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const menuData = await fetchMenu();
      setMenu(menuData || []);
    } catch (err) {
      console.error('помилка завантаження меню', err);
      setLoadError(err.message || 'помилка завантаження меню');
    }

    try {
      const settingsData = await fetchSettings();
      setSettings(settingsData || { is_open: '1' });
    } catch (err) {
      console.warn('помилка завантаження налаштувань, використовуємо стандартні', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    // підписка на миттєве оновлення статусу закладу через sse
    const sub = subscribeToGlobalSettings((newSettings) => {
      setSettings(prev => ({ ...prev, ...newSettings }));
    });

    return () => sub.close();
  }, []);

  // вхід персоналу
  const handleLoginStaff = (user) => {
    setStaffUser(user);
    localStorage.setItem('foodcraft_staff_user', JSON.stringify(user));
  };

  // вихід персоналу
  const handleLogoutStaff = () => {
    setStaffUser(null);
    localStorage.removeItem('foodcraft_staff_user');
  };

  // додавання страви до кошика
  const handleAddToCart = (cartItem) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(item => 
        item.dish.id === cartItem.dish.id &&
        JSON.stringify(item.modifierIds.sort()) === JSON.stringify(cartItem.modifierIds.sort())
      );

      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += cartItem.quantity;
        return next;
      }
      return [...prev, cartItem];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (idx, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter((_, i) => i !== idx));
    } else {
      setCart(prev => {
        const next = [...prev];
        next[idx].quantity = newQty;
        return next;
      });
    }
  };

  const handleRemoveItem = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderSuccess = (newOrder) => {
    setCurrentOrder(newOrder);
    localStorage.setItem('foodcraft_last_order', JSON.stringify(newOrder));
    setActiveView('tracker');
  };

  // фільтрація категорій меню для відображення
  const displayedCategories = selectedCategory === 'all' 
    ? menu 
    : menu.filter(c => c.id === selectedCategory);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        isOpen={settings.is_open === '1'}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenTests={() => setIsTestModalOpen(true)}
        staffUser={staffUser}
        onLogoutStaff={handleLogoutStaff}
      />

      <main style={{ flex: 1 }}>
        {activeView === 'operator' ? (
          <OperatorPanel 
            staffUser={staffUser}
            onLoginSuccess={handleLoginStaff}
            onLogout={handleLogoutStaff}
            onSettingsUpdated={(newSettings) => setSettings(newSettings)}
            onBackToMenu={() => setActiveView('menu')} 
          />
        ) : activeView === 'tracker' && currentOrder ? (
          <OrderTracker 
            initialOrder={currentOrder} 
            onBackToMenu={() => setActiveView('menu')} 
          />
        ) : (
          <div className="container" style={{ paddingBottom: '60px' }}>
            {/* стриманий банер без неонів */}
            <div className="hero">
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#27272a',
                color: '#e4e4e7',
                padding: '4px 12px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.8rem',
                width: 'fit-content',
                border: '1px solid #3f3f46'
              }}>
                <span>Курсова робота - Варіант 11</span>
              </div>
              <h1 className="hero-title">
                Свіжі гарячі страви за вашим індивідуальним розкладом
              </h1>
              <p className="hero-subtitle">
                Обирайте улюблену піцу, бургери та десерти, додавайте модифікатори та бронюйте точний інтервал отримання без очікування в черзі.
              </p>

              {settings.is_open !== '1' && (
                <div style={{
                  background: 'var(--danger-bg)',
                  color: '#f87171',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: '1px solid #7f1d1d',
                  marginTop: '6px'
                }}>
                  <AlertCircle size={20} />
                  <span>Увага: заклад наразі зачинено! Нові замовлення тимчасово не приймаються.</span>
                </div>
              )}
            </div>

            {/* кнопки швидкої фільтрації категорій */}
            <div className="categories-tabs">
              <button
                className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                Всі страви ({menu.reduce((acc, cat) => acc + (cat.dishes?.length || 0), 0)})
              </button>
              {menu.map(category => (
                <button
                  key={category.id}
                  className={`category-tab ${selectedCategory === category.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name} ({category.dishes?.length || 0})
                </button>
              ))}
            </div>

            {/* стан завантаження або помилки */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                <div>Завантаження каталогу страв...</div>
              </div>
            ) : loadError ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
                <div>{loadError}</div>
                <button 
                  className="btn-secondary" 
                  style={{ marginTop: '14px' }}
                  onClick={loadInitialData}
                >
                  Спробувати знову
                </button>
              </div>
            ) : (
              /* відображення всіх категорій та страв */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
                {displayedCategories.map(cat => (
                  <section key={cat.id} className="menu-section">
                    <div className="menu-section-header">
                      <h2 className="menu-section-title">{cat.name}</h2>
                      {cat.description && (
                        <span className="menu-section-desc">- {cat.description}</span>
                      )}
                    </div>

                    <div className="dishes-grid">
                      {cat.dishes?.map(dish => (
                        <div key={dish.id} className="dish-card">
                          <div className="dish-img-wrap">
                            <img 
                              src={dish.image_url} 
                              alt={dish.name} 
                              className="dish-img" 
                              loading="lazy"
                            />
                            {dish.is_available !== 1 && (
                              <div className="dish-unavailable-overlay">
                                ТИМЧАСОВО НЕДОСТУПНО
                              </div>
                            )}
                          </div>

                          <div className="dish-body">
                            <h3 className="dish-name">{dish.name}</h3>
                            <p className="dish-desc">{dish.description}</p>

                            <div className="dish-footer">
                              <div className="dish-price">{dish.base_price.toFixed(2)} грн</div>

                              <button
                                className="btn-primary"
                                style={{ padding: '8px 16px', fontSize: '0.88rem' }}
                                onClick={() => setSelectedDish(dish)}
                                disabled={dish.is_available !== 1 || settings.is_open !== '1'}
                              >
                                {dish.is_available === 1 ? 'Обрати' : 'Недоступно'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* модальне вікно вибору страви та модифікаторів */}
      {selectedDish && (
        <DishModal
          dish={selectedDish}
          onClose={() => setSelectedDish(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* кошик оформлення */}
      {isCartOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setIsCartOpen(false)}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onOrderSuccess={handleOrderSuccess}
        />
      )}

      {/* модальне вікно перевірки для викладача */}
      {isTestModalOpen && (
        <TestScenariosModal
          onClose={() => setIsTestModalOpen(false)}
        />
      )}

      {/* футер сайту */}
      <footer style={{ background: '#18181b', borderTop: '1px solid var(--border-color)', padding: '24px 0', marginTop: 'auto' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div>
            Смак-Арт - Онлайн замовлення страв • Курсова робота (Варіант 11)
          </div>
          <div>
            Node.js (Express + SQLite) + React (Vite + SSE)
          </div>
        </div>
      </footer>
    </div>
  );
}
