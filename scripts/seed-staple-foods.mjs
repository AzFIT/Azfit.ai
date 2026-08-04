#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Phase 39, Item 2 — curated staple food seed generator (zero deps).
   Emits supabase/seed-staple-foods.sql: INSERT … ON CONFLICT
   (source, source_id) DO UPDATE — idempotent, safe to re-apply.

   Values: standard USDA FoodData Central per-100 g references for the
   raw/plain form of each food (cooked where the name says so).
   Exceptions with realistic UNIT servings: whey (30 g scoop) and
   protein bar (60 g bar) — macros are per stated serving.
   ═══════════════════════════════════════════════════════════════════ */

import { writeFileSync } from "fs";

// [name, category, serving_g, kcal, protein, carbs, fats]
const STAPLES = [
  /* ── protein ── */
  ["Chicken Breast", "protein", 100, 120, 22.5, 0, 2.6],
  ["Turkey Breast", "protein", 100, 114, 23.7, 0, 1.5],
  ["Turkey Mince 7%", "protein", 100, 148, 19.7, 0, 7.0],
  ["Lean Beef Mince 5%", "protein", 100, 137, 21.4, 0, 5.0],
  ["Sirloin Steak, Lean", "protein", 100, 152, 26.0, 0, 5.0],
  ["Pork Loin, Lean", "protein", 100, 143, 21.1, 0, 6.1],
  ["Salmon Fillet", "protein", 100, 208, 20.0, 0, 13.0],
  ["Smoked Salmon", "protein", 100, 117, 18.3, 0, 4.3],
  ["Tuna, Canned in Water", "protein", 100, 116, 26.0, 0, 1.0],
  ["Cod Fillet", "protein", 100, 82, 18.0, 0, 0.7],
  ["Haddock Fillet", "protein", 100, 74, 16.3, 0, 0.5],
  ["Mackerel Fillet", "protein", 100, 205, 18.6, 0, 13.9],
  ["Sardines, Canned in Oil, Drained", "protein", 100, 208, 24.6, 0, 11.5],
  ["Prawns", "protein", 100, 85, 20.1, 0, 0.5],
  ["Whole Eggs", "protein", 100, 143, 12.6, 0.7, 9.5],
  ["Egg Whites", "protein", 100, 52, 10.9, 0.7, 0.2],
  ["Greek Yogurt 0%", "dairy", 100, 59, 10.3, 3.6, 0.4],
  ["Cottage Cheese 2%", "dairy", 100, 84, 11.0, 4.3, 2.3],
  ["Quark 0%", "dairy", 100, 67, 12.3, 4.0, 0.2],
  ["Tofu, Firm", "protein", 100, 76, 8.0, 1.9, 4.8],
  ["Tempeh", "protein", 100, 192, 20.3, 7.6, 10.8],
  ["Seitan", "protein", 100, 370, 75.2, 13.8, 1.9],
  ["Edamame, Cooked", "protein", 100, 121, 11.9, 8.9, 5.2],
  ["Whey Protein Powder (30g scoop)", "protein", 30, 120, 24.0, 2.0, 1.5],

  /* ── carbs ── */
  ["White Rice, Cooked", "carbs", 100, 130, 2.7, 28.0, 0.3],
  ["Brown Rice, Cooked", "carbs", 100, 112, 2.6, 23.5, 0.9],
  ["Rolled Oats", "carbs", 100, 389, 16.9, 66.0, 6.9],
  ["Sweet Potato", "carbs", 100, 86, 1.6, 20.0, 0.1],
  ["Potato", "carbs", 100, 77, 2.0, 17.0, 0.1],
  ["Quinoa, Cooked", "carbs", 100, 120, 4.4, 21.3, 1.9],
  ["Wholemeal Bread", "carbs", 100, 247, 13.0, 41.0, 3.4],
  ["Rye Bread", "carbs", 100, 259, 8.5, 48.3, 3.3],
  ["White Pasta, Cooked", "carbs", 100, 158, 5.8, 30.9, 0.9],
  ["Wholemeal Pasta, Cooked", "carbs", 100, 124, 5.3, 26.5, 0.5],
  ["Couscous, Cooked", "carbs", 100, 112, 3.8, 23.2, 0.2],
  ["Wholemeal Tortilla Wrap", "carbs", 100, 262, 8.7, 43.6, 6.4],
  ["Bagel, Plain", "carbs", 100, 257, 10.2, 50.0, 1.6],
  ["Rice Cakes", "carbs", 100, 387, 8.2, 81.5, 2.8],
  ["Sweetcorn", "carbs", 100, 96, 3.4, 21.0, 1.5],
  ["Chickpeas, Canned, Drained", "carbs", 100, 164, 8.9, 27.4, 2.6],
  ["Lentils, Cooked", "carbs", 100, 116, 9.0, 20.1, 0.4],
  ["Kidney Beans, Canned, Drained", "carbs", 100, 127, 8.7, 22.8, 0.5],
  ["Baked Beans in Tomato Sauce", "carbs", 100, 94, 5.0, 15.3, 0.4],
  ["Black Beans, Cooked", "carbs", 100, 132, 8.9, 23.7, 0.5],
  ["Granola", "carbs", 100, 471, 10.0, 64.0, 20.0],
  ["Cornflakes", "carbs", 100, 378, 7.0, 84.0, 0.9],
  ["Honey", "carbs", 100, 304, 0.3, 82.4, 0.0],
  ["Wholemeal English Muffin", "carbs", 100, 220, 9.0, 44.0, 2.0],

  /* ── fruit ── */
  ["Banana", "fruit", 100, 89, 1.1, 22.8, 0.3],
  ["Apple", "fruit", 100, 52, 0.3, 13.8, 0.2],
  ["Blueberries", "fruit", 100, 57, 0.7, 14.5, 0.3],
  ["Strawberries", "fruit", 100, 32, 0.7, 7.7, 0.3],
  ["Orange", "fruit", 100, 47, 0.9, 11.8, 0.1],
  ["Grapes", "fruit", 100, 69, 0.7, 18.1, 0.2],
  ["Pineapple", "fruit", 100, 50, 0.5, 13.1, 0.1],
  ["Mango", "fruit", 100, 60, 0.8, 15.0, 0.4],
  ["Pear", "fruit", 100, 57, 0.4, 15.2, 0.1],
  ["Kiwi", "fruit", 100, 61, 1.1, 14.7, 0.5],
  ["Dates", "fruit", 100, 282, 2.4, 75.0, 0.2],
  ["Raisins", "fruit", 100, 299, 3.1, 79.2, 0.5],
  ["Mixed Berries", "fruit", 100, 50, 0.7, 11.9, 0.3],

  /* ── vegetables ── */
  ["Broccoli", "vegetables", 100, 34, 2.8, 6.6, 0.4],
  ["Spinach", "vegetables", 100, 23, 2.9, 3.6, 0.4],
  ["Green Beans", "vegetables", 100, 31, 1.8, 7.0, 0.2],
  ["Mixed Salad Leaves", "vegetables", 100, 17, 1.5, 2.9, 0.2],
  ["Bell Pepper", "vegetables", 100, 31, 1.0, 6.0, 0.3],
  ["Cucumber", "vegetables", 100, 15, 0.7, 3.6, 0.1],
  ["Carrots", "vegetables", 100, 41, 0.9, 9.6, 0.2],
  ["Tomatoes", "vegetables", 100, 18, 0.9, 3.9, 0.2],
  ["Onion", "vegetables", 100, 40, 1.1, 9.3, 0.1],
  ["Mushrooms", "vegetables", 100, 22, 3.1, 3.3, 0.3],
  ["Courgette", "vegetables", 100, 17, 1.2, 3.1, 0.3],
  ["Kale", "vegetables", 100, 49, 4.3, 8.8, 0.9],
  ["Cauliflower", "vegetables", 100, 25, 1.9, 5.0, 0.3],
  ["Cauliflower Rice", "vegetables", 100, 24, 2.0, 4.7, 0.2],
  ["Asparagus", "vegetables", 100, 20, 2.2, 3.9, 0.1],
  ["Cabbage", "vegetables", 100, 25, 1.3, 5.8, 0.1],

  /* ── fats ── */
  ["Olive Oil", "fats", 100, 884, 0.0, 0.0, 100.0],
  ["Avocado", "fats", 100, 160, 2.0, 8.5, 14.7],
  ["Almonds", "fats", 100, 579, 21.2, 21.6, 49.9],
  ["Peanut Butter, Smooth", "fats", 100, 588, 25.0, 20.0, 50.0],
  ["Almond Butter", "fats", 100, 614, 21.0, 19.0, 56.0],
  ["Chia Seeds", "fats", 100, 486, 16.5, 42.1, 30.7],
  ["Flaxseed", "fats", 100, 534, 18.3, 28.9, 42.2],
  ["Walnuts", "fats", 100, 654, 15.2, 13.7, 65.2],
  ["Cashews", "fats", 100, 553, 18.2, 30.2, 43.8],
  ["Pumpkin Seeds", "fats", 100, 559, 30.2, 10.7, 49.0],
  ["Coconut Oil", "fats", 100, 862, 0.0, 0.0, 100.0],
  ["Butter", "fats", 100, 717, 0.9, 0.1, 81.1],
  ["Olives, Green", "fats", 100, 145, 1.0, 3.8, 15.3],
  ["Tahini", "fats", 100, 595, 17.0, 21.2, 53.8],

  /* ── dairy / snacks ── */
  ["Skyr", "dairy", 100, 63, 11.0, 4.0, 0.2],
  ["Kefir, Plain", "dairy", 100, 41, 3.3, 4.5, 1.0],
  ["Milk, Semi-Skimmed", "dairy", 100, 50, 3.4, 4.8, 2.0],
  ["Mozzarella, Light", "dairy", 100, 215, 18.0, 3.5, 14.0],
  ["Parmesan", "dairy", 100, 431, 38.0, 4.1, 29.0],
  ["Cheddar", "dairy", 100, 403, 24.9, 1.3, 33.1],
  ["Feta", "dairy", 100, 264, 14.2, 4.1, 21.3],
  ["Protein Yogurt, High Protein", "dairy", 100, 60, 10.0, 6.0, 0.4],
  ["Protein Bar (60g bar)", "snacks", 60, 220, 20.0, 22.0, 8.0],
  ["Hummus", "snacks", 100, 166, 7.9, 14.3, 9.6],
  ["Oatcakes", "snacks", 100, 440, 10.0, 63.0, 16.0],
  ["Dark Chocolate 85%", "snacks", 100, 598, 7.8, 45.5, 42.6],
];

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/%/g, "pct")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const seen = new Set();
const rows = STAPLES.map(([name, category, serving, kcal, p, c, f]) => {
  let s = slug(name);
  for (let i = 2; seen.has(s); i++) s = `${slug(name)}-${i}`;
  seen.add(s);
  return { name, category, serving, kcal, p, c, f, slug: s };
});

const esc = (v) => (v === null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const values = rows
  .map(
    (r) =>
      `  ('seed-staples', '${r.slug}', ${esc(r.name)}, null, '${r.category}', ${r.serving}, ${r.kcal}, ${r.p}, ${r.c}, ${r.f}, null)`,
  )
  .join(",\n");

const sql = `-- Phase 39, Item 2 — curated staple foods (source='seed-staples').
-- Generated by scripts/seed-staple-foods.mjs — regenerate, don't hand-edit.
-- Macros: standard USDA FDC per-100 g (unit servings for whey/protein bar).
-- Idempotent: ON CONFLICT (source, source_id) DO UPDATE.
--
-- CONSTRAINT WIDENING (required by the pre-approved Phase 39 design, which
-- specifies source='seed-staples'): foods_cache_source_check previously
-- allowed only ('off','custom'). This is a CHECK-list expansion — no column
-- changes. Mirrored in supabase/schema.sql.

alter table public.foods_cache drop constraint if exists foods_cache_source_check;
alter table public.foods_cache add constraint foods_cache_source_check
  check (source in ('off', 'custom', 'seed-staples'));

insert into public.foods_cache
  (source, source_id, name, brand, category, serving_size_g, calories, protein, carbs, fats, created_by)
values
${values}
on conflict (source, source_id) do update set
  name = excluded.name,
  category = excluded.category,
  serving_size_g = excluded.serving_size_g,
  calories = excluded.calories,
  protein = excluded.protein,
  carbs = excluded.carbs,
  fats = excluded.fats;
`;

writeFileSync("supabase/seed-staple-foods.sql", sql);
const byCat = {};
for (const r of rows) byCat[r.category] = (byCat[r.category] || 0) + 1;
console.log(`wrote supabase/seed-staple-foods.sql — ${rows.length} staples`);
console.log("per category:", JSON.stringify(byCat));
