/**
 * Meal plan generator (Phase 27E) — pure, deterministic, unit-testable.
 * Builds a one-day plan from the foods table against calorie targets,
 * honoring restrictions/allergies and diet preference.
 */

export interface FoodInput {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  serving_size_g: number;
  calories: number; // per serving_size_g
  protein: number;
  carbs: number;
  fats: number;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

export interface MealPlanItem {
  meal: MealType;
  name: string;
  serving_g: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface GeneratedPlan {
  items: MealPlanItem[];
  byMeal: Record<MealType, { calories: number; protein: number; carbs: number; fats: number }>;
  totals: { calories: number; protein: number; carbs: number; fats: number };
}

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

export const MEAL_SPLIT: Record<MealType, number> = {
  breakfast: 0.3,
  lunch: 0.3,
  dinner: 0.3,
  snacks: 0.1,
};

/* Documented keyword lists (kept short on purpose):
 * - MEAT_KEYWORDS: dropped for BOTH 'vegetarian' and 'vegan'
 * - DAIRY_EGG_KEYWORDS: additionally dropped for 'vegan'
 */
const MEAT_KEYWORDS = [
  "chicken", "beef", "pork", "fish", "salmon", "tuna", "meat", "turkey",
  "lamb", "bacon", "ham", "shrimp", "prawn", "duck", "veal", "anchov", "sardine",
];
const DAIRY_EGG_KEYWORDS = [
  "milk", "cheese", "yogurt", "yoghurt", "egg", "butter", "cream", "whey", "dairy",
];

function haystack(food: FoodInput): string {
  return `${food.name} ${food.brand ?? ""} ${food.category ?? ""}`.toLowerCase();
}

export function filterFoods(
  foods: FoodInput[],
  restrictions: string[],
  diet?: string,
): FoodInput[] {
  const terms = restrictions
    .flatMap((r) => r.split(","))
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const isVeg = diet === "vegetarian" || diet === "vegan";
  const isVegan = diet === "vegan";

  return foods.filter((food) => {
    const hay = haystack(food);
    if (terms.some((t) => hay.includes(t))) return false;
    if (isVeg && MEAT_KEYWORDS.some((k) => hay.includes(k))) return false;
    if (isVegan && DAIRY_EGG_KEYWORDS.some((k) => hay.includes(k))) return false;
    return food.calories > 0 && food.serving_size_g > 0;
  });
}

/** Deterministic PRNG (mulberry32) — same seed, same plan. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function round5(g: number): number {
  return Math.max(15, Math.round(g / 5) * 5);
}

function toItem(meal: MealType, food: FoodInput, serving_g: number): MealPlanItem {
  const ratio = serving_g / food.serving_size_g;
  return {
    meal,
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    serving_g,
    calories: Math.round(food.calories * ratio),
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    fats: Math.round(food.fats * ratio * 10) / 10,
  };
}

function buildMeal(meal: MealType, pool: FoodInput[], sliceKcal: number, rng: () => number): MealPlanItem[] {
  if (pool.length === 0 || sliceKcal <= 0) return [];
  const count = Math.min(pool.length, 2 + Math.floor(rng() * 3)); // 2-4 items
  const picked = shuffle(pool, rng).slice(0, count);
  const perItem = sliceKcal / count;
  return picked.map((food) =>
    toItem(meal, food, round5((perItem / food.calories) * food.serving_size_g)),
  );
}

export function generateMealPlan(
  foods: FoodInput[],
  targets: MacroTargets,
  opts: { restrictions?: string[]; diet?: string; seed?: number } = {},
): GeneratedPlan {
  const seed = opts.seed ?? 1;
  const rng = seededRng(seed);
  const filtered = filterFoods(foods, opts.restrictions ?? [], opts.diet);

  const empty = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  };
  const byMeal: GeneratedPlan["byMeal"] = {
    breakfast: { ...empty },
    lunch: { ...empty },
    dinner: { ...empty },
    snacks: { ...empty },
  };
  const items: MealPlanItem[] = [];

  if (filtered.length === 0 || !targets.calories) {
    return { items, byMeal, totals: { ...empty } };
  }

  // Protein-density sorted pool for main meals; anything goes for snacks.
  const byProteinDensity = [...filtered].sort(
    (a, b) => b.protein / b.calories - a.protein / a.calories,
  );
  const mainPool = byProteinDensity.slice(0, Math.max(4, Math.ceil(byProteinDensity.length * 0.6)));

  for (const meal of MEAL_ORDER) {
    const pool = meal === "snacks" ? filtered : mainPool;
    const sliceKcal = targets.calories * MEAL_SPLIT[meal];
    const mealItems = buildMeal(meal, pool, sliceKcal, rng);
    items.push(...mealItems);
    for (const it of mealItems) {
      byMeal[meal].calories += it.calories;
      byMeal[meal].protein += it.protein;
      byMeal[meal].carbs += it.carbs;
      byMeal[meal].fats += it.fats;
    }
    byMeal[meal].protein = Math.round(byMeal[meal].protein * 10) / 10;
    byMeal[meal].carbs = Math.round(byMeal[meal].carbs * 10) / 10;
    byMeal[meal].fats = Math.round(byMeal[meal].fats * 10) / 10;
  }

  const totals = items.reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      protein: Math.round((acc.protein + it.protein) * 10) / 10,
      carbs: Math.round((acc.carbs + it.carbs) * 10) / 10,
      fats: Math.round((acc.fats + it.fats) * 10) / 10,
    }),
    { ...empty },
  );

  return { items, byMeal, totals };
}
