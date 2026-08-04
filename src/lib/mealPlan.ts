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
  source?: string | null; // Phase 39 — 'seed-staples' ranks first
}

/** foods_cache source value for the Phase 39 curated staples. */
export const STAPLE_SOURCE = "seed-staples";

/** Snack-appropriate categories (compared lower-cased). */
const SNACK_CATEGORIES = new Set(["fruit", "snacks", "dairy"]);

function carbDensity(f: FoodInput): number {
  return f.calories > 0 ? (f.carbs * 4) / f.calories : 0;
}

function proteinDensity(f: FoodInput): number {
  return f.calories > 0 ? (f.protein * 4) / f.calories : 0;
}

/**
 * Rank (NOT filter) a food pool for a meal slot (Phase 39).
 * Ordering: 1) seed-staples before everything else (non-staple rows only
 * fill in when the staple pool runs short); 2) for snacks, fruit/snacks/
 * dairy categories before the rest; 3) diet-fit metric — low_carb prefers
 * low carb-density, high_carb high carb-density, everything else high
 * protein-density (the pre-39 mains behavior); 4) name for determinism.
 */
export function rankFoodPool(
  foods: FoodInput[],
  meal: MealType,
  diet?: string,
): FoodInput[] {
  const metric = (f: FoodInput): number =>
    diet === "low_carb"
      ? carbDensity(f)
      : diet === "high_carb"
        ? -carbDensity(f)
        : -proteinDensity(f);
  return [...foods].sort((a, b) => {
    const tierDiff =
      (a.source === STAPLE_SOURCE ? 0 : 1) - (b.source === STAPLE_SOURCE ? 0 : 1);
    if (tierDiff !== 0) return tierDiff;
    if (meal === "snacks") {
      const snackDiff =
        (SNACK_CATEGORIES.has((a.category ?? "").toLowerCase()) ? 0 : 1) -
        (SNACK_CATEGORIES.has((b.category ?? "").toLowerCase()) ? 0 : 1);
      if (snackDiff !== 0) return snackDiff;
    }
    const metricDiff = metric(a) - metric(b);
    if (metricDiff !== 0) return metricDiff;
    return a.name.localeCompare(b.name);
  });
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

/** Resolve a saved plan item name back to a foods_cache row (Phase 38).
 * Plan items store NO food id — names are saved as `name` or
 * `name (brand)` (see toItem). Match both forms, trimmed +
 * case-insensitive; first match wins when names collide.
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

  // Phase 39: pools are RANKED slices (rankFoodPool), not filters —
  // staples first, diet-fit within a tier, snack-category preference for
  // snacks. Pool sizes are capped at the staple count so non-staple rows
  // only fill in when staples alone can't reach the minimum pool of 4
  // (or when no staples exist at all — pre-39 behavior for legacy DBs).
  // buildMeal's seeded shuffle still gives variety within a slice.
  const stapleCount = filtered.filter((f) => f.source === STAPLE_SOURCE).length;
  const capAt = (natural: number) =>
    stapleCount === 0 ? natural : Math.max(4, Math.min(natural, stapleCount));
  const rankedMains = rankFoodPool(filtered, "lunch", opts.diet);
  const mainPool = rankedMains.slice(
    0,
    capAt(Math.max(4, Math.ceil(rankedMains.length * 0.6))),
  );
  const rankedSnacks = rankFoodPool(filtered, "snacks", opts.diet);
  const snackPool = rankedSnacks.slice(
    0,
    capAt(Math.max(4, Math.min(15, rankedSnacks.length))),
  );

  for (const meal of MEAL_ORDER) {
    const pool = meal === "snacks" ? snackPool : mainPool;
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
