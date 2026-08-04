/* ═══════════════════════════════════════════════════════════════════
   Meal Plan V2 (Phase 40) — plate-template construction + macro
   accuracy engine + multi-day plans. Pure & deterministic.

   Plate model (research basis): every main meal = 1 protein + 1 complex
   carb + 1 vegetable/fruit + optional healthy fat; breakfast is
   protein-anchored (≥25 g target). Templates below model the canonical
   dietitian combinations; slots fall back to category pools when a
   preferred food is filtered out (restrictions/diet) or missing.

   Sizing priority per meal: protein slot first (meal protein share),
   then carb, then fat, then veg/fruit as low-kcal filler. A bounded
   iterative fit pass then scales slot quantities so DAILY totals land
   within tolerance (kcal ±5%, protein 90–115%, carbs/fats ±15%),
   returning an honest accuracy report either way.
   ═══════════════════════════════════════════════════════════════════ */

import {
  filterFoods,
  MEAL_ORDER,
  MEAL_SPLIT,
  seededRng,
  STAPLE_SOURCE,
  type FoodInput,
  type MealType,
} from "@/lib/mealPlan";

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export type SlotRole = "protein" | "carb" | "vegfruit" | "fat" | "dairy";

export interface TemplateSlot {
  role: SlotRole;
  /** preferred food names (exact foods_cache names); resolved in order */
  foods: string[];
  optional?: boolean;
}

export interface MealTemplate {
  id: string;
  meal: MealType;
  slots: TemplateSlot[];
}

export interface PlanItemV2 {
  meal: MealType;
  name: string;
  serving_g: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  day: number;
  role: SlotRole;
}

export interface Accuracy {
  kcalPct: number;
  proteinPct: number;
  carbsPct: number;
  fatsPct: number;
}

export interface MultiDayPlan {
  days: number;
  items: PlanItemV2[];
  /** plan-level accuracy = average of per-day percentages (rounded) */
  accuracy: Accuracy;
  /** honest gaps, e.g. "No protein foods available for lunch (day 2)" */
  warnings: string[];
}

/* ── Template table ─────────────────────────────────────────────── */

const T = (
  id: string,
  meal: MealType,
  slots: Array<readonly [SlotRole, string[], boolean?]>,
): MealTemplate => ({
  id,
  meal,
  slots: slots.map(([role, foods, optional]) => ({ role, foods: [...foods], optional: optional === true })),
});

export const MEAL_TEMPLATES: MealTemplate[] = [
  // Breakfast — protein-anchored
  T("yogurt-bowl", "breakfast", [
    ["protein", ["Greek Yogurt 0%", "Skyr", "Quark 0%"]],
    ["carb", ["Rolled Oats", "Granola"]],
    ["vegfruit", ["Blueberries", "Strawberries", "Mixed Berries", "Banana"]],
    ["fat", ["Almonds", "Chia Seeds"], true],
  ]),
  T("eggs-toast", "breakfast", [
    ["protein", ["Whole Eggs", "Egg Whites"]],
    ["carb", ["Wholemeal Bread", "Rye Bread"]],
    ["fat", ["Avocado"]],
    ["vegfruit", ["Tomatoes", "Spinach", "Mushrooms"], true],
  ]),
  T("proats", "breakfast", [
    ["protein", ["Whey Protein Powder (30g scoop)"]],
    ["carb", ["Rolled Oats"]],
    ["vegfruit", ["Banana", "Blueberries", "Mixed Berries"]],
    ["fat", ["Peanut Butter, Smooth"], true],
  ]),
  T("cottage-fruit", "breakfast", [
    ["protein", ["Cottage Cheese 2%", "Greek Yogurt 0%"]],
    ["vegfruit", ["Apple", "Pear", "Banana", "Mixed Berries"]],
    ["carb", ["Rice Cakes", "Wholemeal Bread"]],
    ["fat", ["Walnuts", "Almonds"], true],
  ]),
  T("smoothie", "breakfast", [
    ["protein", ["Whey Protein Powder (30g scoop)"]],
    ["dairy", ["Milk, Semi-Skimmed", "Kefir, Plain"]],
    ["vegfruit", ["Banana", "Mango", "Mixed Berries"]],
    ["carb", ["Rolled Oats", "Spinach"], true],
  ]),
  T("muffin-eggs", "breakfast", [
    ["protein", ["Whole Eggs", "Egg Whites"]],
    ["carb", ["Wholemeal English Muffin", "Bagel, Plain"]],
    ["fat", ["Avocado"]],
    ["vegfruit", ["Tomatoes", "Mushrooms"], true],
  ]),

  // Lunch
  T("chicken-rice", "lunch", [
    ["protein", ["Chicken Breast", "Turkey Breast"]],
    ["carb", ["White Rice, Cooked", "Brown Rice, Cooked"]],
    ["vegfruit", ["Broccoli", "Green Beans"]],
    ["fat", ["Olive Oil"], true],
  ]),
  T("salmon-quinoa", "lunch", [
    ["protein", ["Salmon Fillet"]],
    ["carb", ["Quinoa, Cooked"]],
    ["vegfruit", ["Mixed Salad Leaves", "Asparagus"]],
    ["fat", ["Olive Oil"], true],
  ]),
  T("turkey-wrap", "lunch", [
    ["protein", ["Turkey Breast", "Turkey Mince 7%"]],
    ["carb", ["Wholemeal Tortilla Wrap"]],
    ["vegfruit", ["Bell Pepper", "Mixed Salad Leaves", "Tomatoes"]],
    ["fat", ["Hummus"], true],
  ]),
  T("tuna-potato", "lunch", [
    ["protein", ["Tuna, Canned in Water"]],
    ["carb", ["Potato", "Sweet Potato"]],
    ["vegfruit", ["Green Beans", "Mixed Salad Leaves"]],
  ]),
  T("bean-burrito", "lunch", [
    ["protein", ["Black Beans, Cooked", "Chickpeas, Canned, Drained", "Kidney Beans, Canned, Drained"]],
    ["carb", ["Wholemeal Tortilla Wrap", "White Rice, Cooked"]],
    ["vegfruit", ["Bell Pepper", "Tomatoes"]],
    ["fat", ["Avocado"], true],
  ]),
  T("tofu-stirfry-lunch", "lunch", [
    ["protein", ["Tofu, Firm", "Tempeh", "Edamame, Cooked"]],
    ["carb", ["White Rice, Cooked", "Brown Rice, Cooked"]],
    ["vegfruit", ["Broccoli", "Bell Pepper", "Courgette"]],
  ]),

  // Dinner
  T("salmon-sweetpotato", "dinner", [
    ["protein", ["Salmon Fillet", "Cod Fillet"]],
    ["carb", ["Sweet Potato"]],
    ["vegfruit", ["Green Beans", "Asparagus"]],
  ]),
  T("beef-potato", "dinner", [
    ["protein", ["Lean Beef Mince 5%", "Sirloin Steak, Lean"]],
    ["carb", ["Potato", "Sweet Potato"]],
    ["vegfruit", ["Mixed Salad Leaves", "Tomatoes"]],
  ]),
  T("tofu-stirfry", "dinner", [
    ["protein", ["Tofu, Firm", "Tempeh", "Seitan"]],
    ["carb", ["White Rice, Cooked", "Brown Rice, Cooked"]],
    ["vegfruit", ["Broccoli", "Courgette", "Mushrooms"]],
    ["fat", ["Olive Oil"], true],
  ]),
  T("chicken-pasta", "dinner", [
    ["protein", ["Chicken Breast", "Turkey Mince 7%"]],
    ["carb", ["White Pasta, Cooked", "Wholemeal Pasta, Cooked"]],
    ["vegfruit", ["Courgette", "Bell Pepper", "Spinach"]],
  ]),
  T("prawn-rice", "dinner", [
    ["protein", ["Prawns", "Haddock Fillet"]],
    ["carb", ["White Rice, Cooked", "Brown Rice, Cooked"]],
    ["vegfruit", ["Bell Pepper", "Broccoli"]],
  ]),

  // Snacks
  T("cottage-fruit-snack", "snacks", [
    ["protein", ["Cottage Cheese 2%", "Skyr"]],
    ["vegfruit", ["Apple", "Pear", "Blueberries"]],
  ]),
  T("apple-pb", "snacks", [
    ["vegfruit", ["Apple", "Banana"]],
    ["fat", ["Peanut Butter, Smooth", "Almond Butter"]],
  ]),
  T("skyr-chia", "snacks", [
    ["protein", ["Skyr", "Greek Yogurt 0%"]],
    ["fat", ["Chia Seeds", "Flaxseed"]],
    ["vegfruit", ["Mixed Berries", "Blueberries"], true],
  ]),
  T("hummus-veg", "snacks", [
    ["fat", ["Hummus"]],
    ["vegfruit", ["Cucumber", "Bell Pepper", "Carrots"]],
  ]),
  T("proteinbar-nuts", "snacks", [
    ["protein", ["Protein Bar (60g bar)"]],
    ["fat", ["Almonds", "Walnuts", "Cashews"]],
  ]),
];

/** Role → fallback categories when a slot's preferred foods are all
 * filtered out or missing (documented; legumes live under 'carbs' and
 * are valid vegan protein fallbacks via the carb slot + bean template). */
const ROLE_FALLBACK_CATEGORY: Record<SlotRole, string[]> = {
  protein: ["protein", "dairy"],
  carb: ["carbs"],
  vegfruit: ["vegetables", "fruit"],
  fat: ["fats"],
  dairy: ["dairy"],
};

/* ── Realistic quantity rounding (Phase 40) ─────────────────────── */

/** Gram step per food — unit-based where the food is sold by unit. */
export function roundingStep(food: FoodInput): number {
  const n = food.name.toLowerCase();
  if (n === "whole eggs") return 50; // 1 egg ≈ 50 g
  if (n === "egg whites") return 25;
  if (n.includes("whey protein")) return 30; // 1 scoop
  if (n.includes("protein bar")) return 60; // 1 bar
  if (n.includes("tortilla wrap")) return 60; // 1 wrap
  if (n.includes("bagel")) return 85; // 1 bagel
  if (n.includes("english muffin")) return 45; // 1 muffin
  if (n.includes("bread")) return 40; // 1 slice
  if (n.includes("rice cakes")) return 10; // 1 cake
  const cat = (food.category ?? "").toLowerCase();
  if (cat === "protein") return 10; // meat/fish
  if (cat === "dairy") return 25;
  return 5;
}

/** Smallest sensible serving for a food. */
export function minServing(food: FoodInput): number {
  const step = roundingStep(food);
  return Math.max(step, step <= 10 ? 10 : step);
}

/** Largest sensible single-slot serving (keeps plates realistic; the fit
 * pass and warnings handle any resulting shortfall honestly). The fat
 * cap is generous because need-driven sizing keeps dense fats (oils)
 * small while low-density ones (avocado) legitimately need 100 g+. */
function maxServing(role: SlotRole): number {
  switch (role) {
    case "protein": return 400;
    case "carb": return 400;
    case "fat": return 120;
    case "vegfruit": return 250;
    case "dairy": return 350;
  }
}

function roundTo(g: number, food: FoodInput, role: SlotRole): number {
  const step = roundingStep(food);
  const rounded = Math.round(g / step) * step;
  return Math.min(maxServing(role), Math.max(minServing(food), rounded));
}

const perG = (food: FoodInput) => ({
  kcal: food.calories / food.serving_size_g,
  protein: food.protein / food.serving_size_g,
  carbs: food.carbs / food.serving_size_g,
  fats: food.fats / food.serving_size_g,
});

function toItem(meal: MealType, role: SlotRole, food: FoodInput, grams: number, day: number): PlanItemV2 {
  const p = perG(food);
  return {
    meal,
    name: food.name,
    serving_g: grams,
    calories: Math.round(p.kcal * grams),
    protein: Math.round(p.protein * grams * 10) / 10,
    carbs: Math.round(p.carbs * grams * 10) / 10,
    fats: Math.round(p.fats * grams * 10) / 10,
    day,
    role,
  };
}

/* ── Per-meal protein shares (main meals ≥20% of daily protein;
   breakfast ≥25 g unless that exceeds half the daily target — then
   best effort, documented). ─────────────────────────────────────── */
const PROTEIN_SHARE: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.3,
  snacks: 0.15,
};

function mealProteinTarget(meal: MealType, daily: MacroTargets): number {
  const share = daily.protein * PROTEIN_SHARE[meal];
  if (meal === "breakfast") return Math.min(Math.max(25, share), daily.protein * 0.6);
  return share;
}

/* ── Assembly ───────────────────────────────────────────────────── */

interface AssemblyContext {
  /** meal → protein food name used the previous day (consecutive rule) */
  prevProtein: Partial<Record<MealType, string>>;
  /** meal → used `${templateId}:${protein}|${carb}` keys (no identical meals) */
  usedCombos: Map<MealType, Set<string>>;
  warnings: string[];
  day: number;
}

interface MealPlanOpts {
  restrictions?: string[];
  diet?: string;
  seed?: number;
}

function pickSlotFood(
  slot: TemplateSlot,
  pool: FoodInput[],
  rng: () => number,
  excludeNames: Set<string>,
): FoodInput | null {
  const byName = new Map(pool.map((f) => [f.name, f]));
  const preferred = slot.foods
    .map((n) => byName.get(n))
    .filter((f): f is FoodInput => !!f && !excludeNames.has(f.name));
  const ordered = shuffleWith(preferred, rng);
  if (ordered.length > 0) return ordered[0];
  // fallback: any pool food in the role's categories, staples first
  const cats = ROLE_FALLBACK_CATEGORY[slot.role];
  const fallback = pool.filter(
    (f) =>
      cats.includes((f.category ?? "").toLowerCase()) && !excludeNames.has(f.name),
  );
  fallback.sort((a, b) => {
    const tier = (a.source === STAPLE_SOURCE ? 0 : 1) - (b.source === STAPLE_SOURCE ? 0 : 1);
    return tier !== 0 ? tier : a.name.localeCompare(b.name);
  });
  return fallback[0] ?? null;
}

const ROLE_ORDER: SlotRole[] = ["protein", "carb", "vegfruit", "fat", "dairy"];

/** Canonical meal-identity key (canonical role order). */
function comboKeyOf(get: (role: SlotRole) => string | undefined): string {
  return ROLE_ORDER.map((r) => get(r) ?? "").join("|");
}

function shuffleWith<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function assembleMeal(
  meal: MealType,
  pool: FoodInput[],
  targets: MacroTargets,
  rng: () => number,
  ctx: AssemblyContext,
): PlanItemV2[] {
  const templates = shuffleWith(
    MEAL_TEMPLATES.filter((t) => t.meal === meal),
    rng,
  );
  const mealKcal = targets.calories * MEAL_SPLIT[meal];
  const proteinTargetG = mealProteinTarget(meal, targets);

  for (const template of templates) {
    const chosen = new Map<SlotRole, FoodInput>();
    let ok = true;
    for (const slot of template.slots) {
      const exclude = new Set<string>();
      if (slot.role === "protein" && ctx.prevProtein[meal]) {
        exclude.add(ctx.prevProtein[meal]!);
      }
      const food = pickSlotFood(slot, pool, rng, exclude);
      if (!food) {
        if (slot.optional) continue;
        ok = false;
        break;
      }
      chosen.set(slot.role, food);
    }
    if (!ok) continue;

    const proteinFood = chosen.get("protein");
    const carbFood = chosen.get("carb");
    // "Identical meal" = same full slot-food set, in canonical role
    // order so regenerateDay can rebuild the same key from saved items.
    const comboKey = comboKeyOf((role) => chosen.get(role)?.name);
    if (ctx.usedCombos.get(meal)?.has(comboKey)) continue; // no identical meal twice

    // Size slots in priority order: protein → carb → fat → veg/fruit filler
    const items: PlanItemV2[] = [];
    let kcalSoFar = 0;
    let carbsSoFar = 0;
    let fatsSoFar = 0;

    if (proteinFood) {
      const p = perG(proteinFood);
      const grams = roundTo(
        p.protein > 0 ? proteinTargetG / p.protein : 0,
        proteinFood,
        "protein",
      );
      const item = toItem(meal, "protein", proteinFood, grams, ctx.day);
      items.push(item);
      kcalSoFar += item.calories;
      carbsSoFar += item.carbs;
      fatsSoFar += item.fats;
    }

    const carbTargetG = targets.carbs * MEAL_SPLIT[meal];
    if (carbFood) {
      const p = perG(carbFood);
      const need = Math.max(0, carbTargetG - carbsSoFar);
      const grams = roundTo(
        p.carbs > 0 ? need / p.carbs : 0,
        carbFood,
        "carb",
      );
      const item = toItem(meal, "carb", carbFood, grams, ctx.day);
      items.push(item);
      kcalSoFar += item.calories;
      carbsSoFar += item.carbs;
      fatsSoFar += item.fats;
    }

    const fatFood = chosen.get("fat");
    if (fatFood) {
      const fatTargetG = targets.fats * MEAL_SPLIT[meal];
      const p = perG(fatFood);
      const need = Math.max(0, fatTargetG - fatsSoFar);
      const grams = roundTo(
        p.fats > 0 ? need / p.fats : 0,
        fatFood,
        "fat",
      );
      const item = toItem(meal, "fat", fatFood, grams, ctx.day);
      items.push(item);
      kcalSoFar += item.calories;
      fatsSoFar += item.fats;
    }

    for (const role of ["vegfruit", "dairy"] as const) {
      const food = chosen.get(role);
      if (!food) continue;
      const p = perG(food);
      const kcalLeft = Math.max(0, mealKcal - kcalSoFar);
      const grams = roundTo(
        p.kcal > 0 ? kcalLeft / p.kcal : 0,
        food,
        role,
      );
      const item = toItem(meal, role, food, grams, ctx.day);
      items.push(item);
      kcalSoFar += item.calories;
    }

    ctx.usedCombos.get(meal)?.add(comboKey);
    return items;
  }

  // No template could be filled — honest warning, best-effort empty meal
  ctx.warnings.push(
    `No foods available to build ${meal} (day ${ctx.day}) after filters`,
  );
  return [];
}

/* ── Macro accuracy engine ──────────────────────────────────────── */


function totals(items: PlanItemV2[]): MacroTargets {
  return items.reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      protein: acc.protein + it.protein,
      carbs: acc.carbs + it.carbs,
      fats: acc.fats + it.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

function within(t: MacroTargets, target: MacroTargets): boolean {
  if (target.calories > 0) {
    const k = t.calories / target.calories;
    if (k < 0.95 || k > 1.05) return false;
  }
  if (target.protein > 0) {
    const p = t.protein / target.protein;
    if (p < 0.9 || p > 1.15) return false;
  }
  if (target.carbs > 0) {
    const c = t.carbs / target.carbs;
    if (c < 0.85 || c > 1.15) return false;
  }
  if (target.fats > 0) {
    const f = t.fats / target.fats;
    if (f < 0.85 || f > 1.15) return false;
  }
  return true;
}

/**
 * Band-deviation score: squared normalized deviation OUTSIDE each
 * macro's tolerance band (kcal ±5%, protein 90–115%, carbs/fats ±15%),
 * plus a tiny kcal-centering tiebreak. Zero-ish = fully in band.
 */
function bandScore(t: MacroTargets, targets: MacroTargets): number {
  const dev = (actual: number, target: number, lo: number, hi: number) => {
    if (target <= 0) return 0;
    const r = actual / target;
    return Math.max(0, r - hi, lo - r) ** 2;
  };
  const outside =
    dev(t.calories, targets.calories, 0.95, 1.05) +
    dev(t.protein, targets.protein, 0.9, 1.15) +
    dev(t.carbs, targets.carbs, 0.85, 1.15) +
    dev(t.fats, targets.fats, 0.85, 1.15);
  const center =
    targets.calories > 0 ? Math.abs(t.calories / targets.calories - 1) * 0.001 : 0;
  return outside * 1000 + center;
}

/** Top-up foods per role (dense, plate-plausible additions the hill-
 * climb may introduce: add an oil to a meal, add a whey scoop) and the
 * max grams a top-up item may reach. */
const TOP_UP_FOODS: Partial<Record<SlotRole, string[]>> = {
  fat: ["Olive Oil", "Chia Seeds", "Flaxseed"],
  protein: ["Whey Protein Powder (30g scoop)", "Egg Whites"],
};
const TOP_UP_MAX_G: Partial<Record<SlotRole, number>> = { fat: 40, protein: 60 };

function applyGrams(item: PlanItemV2, food: FoodInput, grams: number): void {
  const p = perG(food);
  item.serving_g = grams;
  item.calories = Math.round(p.kcal * grams);
  item.protein = Math.round(p.protein * grams * 10) / 10;
  item.carbs = Math.round(p.carbs * grams * 10) / 10;
  item.fats = Math.round(p.fats * grams * 10) / 10;
}

/**
 * Macro accuracy engine: steepest-descent hill-climb over single-item
 * ±step quantity moves (plus top-up add/grow moves). Monotone improving,
 * deterministic (fixed move order, strict-improvement), bounded at
 * FIT_MAX_ITERS; if the band is unreachable with the available foods
 * the best attempt is returned and reported honestly via accuracyOf.
 */
const FIT_MAX_ITERS = 300;

export function fitDayToTargets(
  dayItems: PlanItemV2[],
  targets: MacroTargets,
  foods: FoodInput[],
): PlanItemV2[] {
  const foodsByName = new Map(foods.map((f) => [f.name, f]));
  const items = dayItems.map((it) => ({ ...it }));
  if (items.length === 0) return items;
  const day = items[0].day;

  // Resolve one top-up food per role (first available in the pool)
  const topUpFoods: Array<{ role: SlotRole; food: FoodInput }> = [];
  for (const role of ["fat", "protein"] as const) {
    for (const name of TOP_UP_FOODS[role] ?? []) {
      const food = foodsByName.get(name);
      if (food) {
        topUpFoods.push({ role, food });
        break;
      }
    }
  }

  type Move =
    | { kind: "adjust"; idx: number; grams: number }
    | { kind: "add"; role: SlotRole; food: FoodInput; grams: number; meal: MealType };

  for (let iter = 0; iter < FIT_MAX_ITERS; iter++) {
    if (within(totals(items), targets)) break;
    let bestScore = bandScore(totals(items), targets);
    let bestMove: Move | null = null;

    // ±step moves on every existing item (single + 4× step — the 4×
    // jump keeps convergence fast for large fillers like vegetables)
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const food = foodsByName.get(it.name);
      if (!food) continue;
      const step = roundingStep(food);
      for (const mult of [1, 4]) {
        for (const dir of [1, -1] as const) {
          const grams = it.serving_g + dir * step * mult;
          if (grams < minServing(food) || grams > maxServing(it.role)) continue;
          const saved = it.serving_g;
          applyGrams(it, food, grams);
          const s = bandScore(totals(items), targets);
          applyGrams(it, food, saved);
          if (s < bestScore - 1e-9) {
            bestScore = s;
            bestMove = { kind: "adjust", idx, grams };
          }
        }
      }
    }

    // top-up moves: grow an existing top-up item, or introduce one
    for (const { role, food } of topUpFoods) {
      const cap = TOP_UP_MAX_G[role]!;
      const step = roundingStep(food);
      const existingIdx = items.findIndex((i) => i.role === role && i.name === food.name);
      if (existingIdx >= 0) {
        const grams = items[existingIdx].serving_g + step;
        if (grams <= cap) {
          const saved = items[existingIdx].serving_g;
          applyGrams(items[existingIdx], food, grams);
          const s = bandScore(totals(items), targets);
          applyGrams(items[existingIdx], food, saved);
          if (s < bestScore - 1e-9) {
            bestScore = s;
            bestMove = { kind: "adjust", idx: existingIdx, grams };
          }
        }
      } else {
        const mealsPresent = [...new Set(items.map((i) => i.meal))];
        const meal =
          mealsPresent.find((m) => !items.some((i) => i.meal === m && i.role === role)) ??
          mealsPresent[0];
        const newItem = toItem(meal, role, food, minServing(food), day);
        items.push(newItem);
        const s = bandScore(totals(items), targets);
        items.pop();
        if (s < bestScore - 1e-9) {
          bestScore = s;
          bestMove = { kind: "add", role, food, grams: minServing(food), meal };
        }
      }
    }

    if (!bestMove) break; // local optimum / stall — best effort
    if (bestMove.kind === "adjust") {
      const it = items[bestMove.idx];
      applyGrams(it, foodsByName.get(it.name)!, bestMove.grams);
    } else {
      items.push(toItem(bestMove.meal, bestMove.role, bestMove.food, bestMove.grams, day));
    }
  }
  return items;
}

export function accuracyOf(items: PlanItemV2[], targets: MacroTargets): Accuracy {
  const t = totals(items);
  const pct = (actual: number, target: number) =>
    target > 0 ? Math.round((actual / target) * 100) : 0;
  return {
    kcalPct: pct(t.calories, targets.calories),
    proteinPct: pct(t.protein, targets.protein),
    carbsPct: pct(t.carbs, targets.carbs),
    fatsPct: pct(t.fats, targets.fats),
  };
}

/* ── Multi-day orchestration ────────────────────────────────────── */

export interface MultiDayOpts extends MealPlanOpts {
  days?: number; // 1–7
}

export function generateMultiDayPlan(
  foods: FoodInput[],
  targets: MacroTargets,
  opts: MultiDayOpts = {},
): MultiDayPlan {
  const days = Math.max(1, Math.min(7, opts.days ?? 5));
  const pool = filterFoods(foods, opts.restrictions ?? [], opts.diet);
  const warnings: string[] = [];
  const items: PlanItemV2[] = [];

  const ctx: AssemblyContext = {
    prevProtein: {},
    usedCombos: new Map(MEAL_ORDER.map((m) => [m, new Set<string>()])),
    warnings,
    day: 1,
  };

  const perDayAccuracy: Accuracy[] = [];
  for (let day = 1; day <= days; day++) {
    ctx.day = day;
    const rng = seededRng(((opts.seed ?? 1) * 1000 + day * 37) >>> 0);
    const dayItems: PlanItemV2[] = [];
    for (const meal of MEAL_ORDER) {
      const mealItems = assembleMeal(meal, pool, targets, rng, ctx);
      const protein = mealItems.find((i) => i.role === "protein");
      if (protein) ctx.prevProtein[meal] = protein.name;
      dayItems.push(...mealItems);
    }
    const fitted = fitDayToTargets(dayItems, targets, pool);
    perDayAccuracy.push(accuracyOf(fitted, targets));
    items.push(...fitted);
  }

  const avg = (vals: number[]) =>
    Math.round(vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length));
  const accuracy: Accuracy = {
    kcalPct: avg(perDayAccuracy.map((a) => a.kcalPct)),
    proteinPct: avg(perDayAccuracy.map((a) => a.proteinPct)),
    carbsPct: avg(perDayAccuracy.map((a) => a.carbsPct)),
    fatsPct: avg(perDayAccuracy.map((a) => a.fatsPct)),
  };

  if (accuracy.proteinPct < 90) {
    warnings.push(
      `Best effort: protein averages ${accuracy.proteinPct}% of target (90% floor not reachable with available foods)`,
    );
  }

  return { days, items, accuracy, warnings };
}

/**
 * Regenerate ONE day of an existing plan (Phase 40 UI): the other days
 * stay untouched. Variety context is rebuilt from those days (no
 * identical meals, no protein repeat vs the previous/next day), and the
 * new day is seeded by `salt` so each click produces a fresh day.
 */
export function regenerateDay(
  existingItems: PlanItemV2[],
  day: number,
  foods: FoodInput[],
  targets: MacroTargets,
  opts: MealPlanOpts & { salt: number },
): PlanItemV2[] {
  const pool = filterFoods(foods, opts.restrictions ?? [], opts.diet);
  const others = existingItems.filter((i) => i.day !== day);
  const warnings: string[] = [];

  const usedCombos = new Map<MealType, Set<string>>(MEAL_ORDER.map((m) => [m, new Set<string>()]));
  const seenPairs = new Set<string>();
  for (const it of others) {
    const pairKey = `${it.day}:${it.meal}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const dayItems = others.filter((o) => o.day === it.day && o.meal === it.meal);
    usedCombos.get(it.meal)!.add(
      comboKeyOf((role) => dayItems.find((i) => i.role === role)?.name),
    );
  }

  const prevDay = day - 1;
  const nextDay = day + 1;
  const ctx: AssemblyContext = { prevProtein: {}, usedCombos, warnings, day };
  const rng = seededRng(((opts.seed ?? 1) * 1000 + opts.salt * 977 + day * 37) >>> 0);

  const dayItems: PlanItemV2[] = [];
  for (const meal of MEAL_ORDER) {
    const neighbors = others.filter(
      (i) => (i.day === prevDay || i.day === nextDay) && i.meal === meal && i.role === "protein",
    );
    // avoid both neighbors' proteins (consecutive rule, both directions)
    const excludeNames = new Set(neighbors.map((n) => n.name));
    const mealItems = assembleMealAvoiding(meal, pool, targets, rng, ctx, excludeNames);
    dayItems.push(...mealItems);
  }
  return fitDayToTargets(dayItems, targets, pool);
}

/** assembleMeal variant that also excludes specific protein names
 * (used by regenerateDay for two-sided neighbor avoidance). */
function assembleMealAvoiding(
  meal: MealType,
  pool: FoodInput[],
  targets: MacroTargets,
  rng: () => number,
  ctx: AssemblyContext,
  excludeProteins: Set<string>,
): PlanItemV2[] {
  // Temporarily remove excluded proteins from the pool for this meal
  const narrowed = pool.filter((f) => !excludeProteins.has(f.name));
  return assembleMeal(meal, narrowed.length > 0 ? narrowed : pool, targets, rng, ctx);
}
