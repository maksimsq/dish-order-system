const express = require('express');
const router = express.Router();
const { db } = require('../db');

// отримання повного меню з категоріями та модифікаторами
router.get('/', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all();
    const dishes = db.prepare('SELECT * FROM dishes').all();
    const groups = db.prepare('SELECT * FROM modifier_groups').all();
    const modifiers = db.prepare('SELECT * FROM modifiers').all();

    // групуємо модифікатори по групах
    const modsByGroup = new Map();
    for (const mod of modifiers) {
      if (!modsByGroup.has(mod.group_id)) {
        modsByGroup.set(mod.group_id, []);
      }
      modsByGroup.get(mod.group_id).push(mod);
    }

    // групуємо групи модифікаторів по стравах
    const groupsByDish = new Map();
    for (const group of groups) {
      if (!groupsByDish.has(group.dish_id)) {
        groupsByDish.set(group.dish_id, []);
      }
      groupsByDish.get(group.dish_id).push({
        ...group,
        modifiers: modsByGroup.get(group.id) || []
      });
    }

    // формуємо страви з групами
    const dishesWithMods = dishes.map(dish => ({
      ...dish,
      modifier_groups: groupsByDish.get(dish.id) || []
    }));

    // групуємо страви по категоріях
    const menu = categories.map(cat => ({
      ...cat,
      dishes: dishesWithMods.filter(d => d.category_id === cat.id)
    }));

    res.json({
      success: true,
      data: menu
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
