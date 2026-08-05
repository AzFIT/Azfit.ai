/**
 * Meal-plan shared primitives (Phase 46 — slimmed down).
 * The 27E generateMealPlan and the 39 rankFoodPool were retired here:
 * both had zero callers after Phase 40's mealPlanV2 (template-driven
 * construction + macro-fit engine) replaced them. What remains is
 * everything V2 and the log-from-plan path still use: types, the
 * meal constants, restriction/diet filtering, the deterministic PRNG,
 * and saved-item name resolution.
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
  source?: string | null; // Phase 39 — 'seed-staples' ranks first
}

/** foods_cache source value for the Phase 39 curated staples. */
export const STAPLE_SOURCE = "seed-staples";

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

/** Resolve a saved plan item name back to a foods_cache row (Phase 38).
 * Plan items store NO food id — names are saved as `name` or
 * `name (brand)` (the 27F/40 storage format). Match both forms,
 * trimmed + case-insensitive; first match wins when names collide.
 * Returns null when nothing matches exactly — callers skip the item
 * rather than log garbage. */
export function resolvePlanFood(
  itemName: string,
  foods: FoodInput[],
): FoodInput | null {
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(itemName);
  return (
    foods.find((f) => norm(f.name) === target) ??
    foods.find(
      (f) => f.brand != null && norm(`${f.name} (${f.brand})`) === target,
    ) ??
    null
  );
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
  // Phase 40: whole-fish staples the original list missed
  "cod", "haddock", "mackerel", "tilapia", "trout",
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
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
