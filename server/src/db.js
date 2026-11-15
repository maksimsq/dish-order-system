const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

// ініціалізація бази даних у файлі
const dbPath = path.join(__dirname, '..', 'restaurant.sqlite');
const db = new DatabaseSync(dbPath);

// створення таблиць системи
function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      ingredients TEXT NOT NULL,
      allergens TEXT,
      base_price REAL NOT NULL,
      image_url TEXT,
      is_available INTEGER DEFAULT 1,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS modifier_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dish_id INTEGER,
      name TEXT NOT NULL,
      min_selection INTEGER DEFAULT 0,
      max_selection INTEGER DEFAULT 1,
      is_required INTEGER DEFAULT 0,
      FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_email TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      delivery_type TEXT NOT NULL DEFAULT 'pickup',
      slot_time TEXT NOT NULL,
      total_price REAL NOT NULL,
      notes TEXT,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      dish_id INTEGER NOT NULL,
      dish_name TEXT NOT NULL,
      dish_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      item_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_item_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER NOT NULL,
      modifier_id INTEGER NOT NULL,
      modifier_name TEXT NOT NULL,
      modifier_price REAL NOT NULL,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
    );
  `);

  // заповнюємо початкові налаштування якщо порожньо
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM settings');
  const count = countStmt.get().count;

  if (count === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('is_open', '1');
    insertSetting.run('opening_time', '10:00');
    insertSetting.run('closing_time', '22:00');
    insertSetting.run('max_orders_per_slot', '3');
    insertSetting.run('slot_interval_minutes', '20');
    insertSetting.run('operator_token', 'operator_secret_token_123');
  }

  // заповнюємо демонстраційне меню
  seedDemoData();
}

// заповнення меню початковими стравами та модифікаторами
function seedDemoData() {
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount > 0) return;

  const insertCat = db.prepare('INSERT INTO categories (name, description, sort_order) VALUES (?, ?, ?)');
  insertCat.run('Піца', 'Авторська неаполітанська піца з дровяної печі', 1);
  insertCat.run('Бургери', 'Соковиті бургери з яловичою котлетою', 2);
  insertCat.run('Напої', 'Освіжаючі лимонади та крафтові чаї', 3);
  insertCat.run('Десерти', 'Ніжні десерти власного приготування', 4);

  const insertDish = db.prepare(`
    INSERT INTO dishes (category_id, name, description, ingredients, allergens, base_price, image_url, is_available)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  // піца 1
  insertDish.run(
    1,
    'Піца Маргарита Класична',
    'Традиційна італійська піца з томатним соусом та базиліком',
    'Борошно пшеничне твердих сортів, томатний соус San Marzano, моцарела, свіжий базилік, оливкова олія extra virgin',
    'Глютен, лактоза',
    185,
    'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80'
  );

  // піца 2
  insertDish.run(
    1,
    'Піца Чотири Сири',
    'Вишукане поєднання чотирьох шляхетних сирів з медовим соусом',
    'Тісто пшеничне, вершковий соус, моцарела, горгонзола, пармезан, сир брі, волоський горіх',
    'Глютен, лактоза, горіхи',
    240,
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'
  );

  // бургер 1
  insertDish.run(
    2,
    'Блек Бургер з яловичиною',
    'Фірмовий бургер на чорній булочці з карамелізованою цибулею',
    'Булочка бріош з чорнилами каракатиці, котлета з витриманої яловичини, сир чеддер, маринований огірок, соус BBQ',
    'Глютен, лактоза, соя, гірчиця',
    210,
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80'
  );

  // бургер 2
  insertDish.run(
    2,
    'Чікен Бургер Кріспі',
    'Хрустке куряче філе в кукурудзяному паніруванні з соусом тар-тар',
    'Булочка пшенична з кунжутом, мариноване куряче філе, листя салату айсберг, свіжий томат, домашній тар-тар',
    'Глютен, яйця, кунжут',
    190,
    'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=600&q=80'
  );

  // напій 1
  insertDish.run(
    3,
    'Лимонад Цитрус - Імбир',
    'Натуральний освіжаючий лимонад з легким гострим післясмаком',
    'Свіжовичавлений апельсиновий та лимонний сік, корінь імбиру, тростинний цукор, газована вода, м-ята',
    'Алергени відсутні',
    75,
    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80'
  );

  // десерт 1
  insertDish.run(
    4,
    'Чізкейк Нью-Йорк з ягодами',
    'Класичний вершковий чізкейк на пісочній основі з полуничним кюлі',
    'Крем-сир Філадельфія, пісочне печиво, натуральне вершкове масло, яйця курячі, полуниця, цукрова пудра',
    'Глютен, лактоза, яйця',
    125,
    'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80'
  );

  // додаємо групи модифікаторів для Маргарити (dish_id = 1)
  const insertGroup = db.prepare(`
    INSERT INTO modifier_groups (dish_id, name, min_selection, max_selection, is_required)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMod = db.prepare(`
    INSERT INTO modifiers (group_id, name, price, is_available)
    VALUES (?, ?, ?, 1)
  `);

  // розмір для маргарити (обов'язковий вибір 1 з 3)
  insertGroup.run(1, 'Розмір піци', 1, 1, 1);
  insertMod.run(1, 'Стандартний (30 см)', 0);
  insertMod.run(1, 'Великий (35 см)', 45);
  insertMod.run(1, 'Гігант (40 см)', 80);

  // додатки для маргарити (необов'язкові, від 0 до 3)
  insertGroup.run(1, 'Додаткові топінги', 0, 3, 0);
  insertMod.run(2, 'Подвійний сир моцарела', 35);
  insertMod.run(2, 'Печериці свіжі', 25);
  insertMod.run(2, 'В-ялені томати', 30);
  insertMod.run(2, 'Пармезан тертий', 30);

  // бортик для піци
  insertGroup.run(1, 'Опція бортика', 0, 1, 0);
  insertMod.run(3, 'Сирний бортик', 40);
  insertMod.run(3, 'Ковбасний бортик', 45);

  // модифікатори для блек бургера (dish_id = 3)
  insertGroup.run(3, 'Прожарка котлети', 1, 1, 1);
  insertMod.run(4, 'Medium Well (стандарт)', 0);
  insertMod.run(4, 'Well Done (повна прожарка)', 0);

  insertGroup.run(3, 'Додатки до бургера', 0, 3, 0);
  insertMod.run(5, 'Хрусткий бекон', 30);
  insertMod.run(5, 'Додатковий чеддер', 25);
  insertMod.run(5, 'Перець халапеньйо', 20);
  insertMod.run(5, 'Смажене яйце', 20);

  insertGroup.run(3, 'Вибір соусу', 0, 2, 0);
  insertMod.run(6, 'Фірмовий бургерний соус', 15);
  insertMod.run(6, 'Гострий шрірача', 15);
  insertMod.run(6, 'Часниковий айолі', 15);
}

module.exports = {
  db,
  initDatabase
};
