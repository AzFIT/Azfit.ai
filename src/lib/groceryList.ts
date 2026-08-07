/* ═══════════════════════════════════════════════════════════════════
   Grocery list (Phase 51) — pure aggregation.
   Plan items (27F/40 shape: { name, serving_g, day?, calories?,
   protein?, carbs?, fats? }) → resolved via the SHARED resolvePlanFood
   (exact match, never guesses) → aggregated per food, grouped by the
   fixed category order. foods_cache 'snacks' and any OFF-import
   category fold into "other" (documented — the fixed order has no
   snacks bucket).
   ═══════════════════════════════════════════════════════════════════ */

import { resolvePlanFood, type FoodInput } from "@/lib/mealPlan";

export interface PlanItemLike {
  name: string;
  serving_g: number;
  day?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

export interface GroceryItem {
  /** stable key: food id when resolved, else `name:<lowered>` */
  key: string;
  name: string;
  category: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  matched: boolean;
}

export const CATEGORY_ORDER = [
  "protein",
  "carbs",
  "vegetables",
  "fruit",
  "dairy",
  "fats",
  "other",
  "unmatched",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  protein: "Protein",
  carbs: "Carbs & Grains",
  vegetables: "Vegetables",
  fruit: "Fruit",
  dairy: "Dairy",
  fats: "Fats & Oils",
  other: "Other",
  unmatched: "Unmatched",
};

export function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

/** foods_cache category → grocery bucket (documented fold: snacks → other). */
function bucketOf(category: string | null | undefined): string {
  const c = (category ?? "").toLowerCase();
  if ((CATEGORY_ORDER as readonly string[]).includes(c)) return c;
  return "other";
}

/** Aggregate plan items into grocery rows. days null/undefined = all days. */
export function buildGroceryList(
  items: PlanItemLike[],
  foods: FoodInput[],
  days?: number[] | null,
): GroceryItem[] {
  const wanted = days && days.length > 0 ? new Set(days) : null;
  const byKey = new Map<string, GroceryItem>();

  for (const it of items) {
    if (wanted && !wanted.has(it.day ?? 1)) continue;
    const food = resolvePlanFood(it.name, foods);
    const key = food ? food.id : `name:${it.name.trim().toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.grams += it.serving_g;
      existing.kcal += it.calories ?? 0;
      existing.protein += it.protein ?? 0;
      existing.carbs += it.carbs ?? 0;
      existing.fats += it.fats ?? 0;
    } else {
      byKey.set(key, {
        key,
        name: food?.name ?? it.name,
        category: food ? bucketOf(food.category) : "unmatched",
        grams: it.serving_g,
        kcal: it.calories ?? 0,
        protein: it.protein ?? 0,
        carbs: it.carbs ?? 0,
        fats: it.fats ?? 0,
        matched: !!food,
      });
    }
  }

  return orderGroceryList([...byKey.values()]);
}

/** Fixed category order, then name. Returns a new array. */
export function orderGroceryList(items: GroceryItem[]): GroceryItem[] {
  const rank = (c: string) => CATEGORY_ORDER.indexOf(c as (typeof CATEGORY_ORDER)[number]);
  return [...items].sort(
    (a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name),
  );
}

/** Scale a list by a serving multiplier — a PURE function of the base
 * list; the plan is never mutated. */
export function applyMultiplier(items: GroceryItem[], mult: number): GroceryItem[] {
  if (mult === 1) return items;
  return items.map((it) => ({
    ...it,
    grams: it.grams * mult,
    kcal: it.kcal * mult,
    protein: it.protein * mult,
    carbs: it.carbs * mult,
    fats: it.fats * mult,
  }));
}

/** Sensible display quantity: nearest 5 g; kg (2dp trimmed) at ≥1000 g. */
export function formatQuantity(grams: number): string {
  const rounded = Math.round(grams / 5) * 5;
  if (rounded >= 1000) {
    const kg = Math.round((rounded / 1000) * 100) / 100;
    return `${kg} kg`;
  }
  return `${rounded} g`;
}

/** Checked items sink to the bottom of their category (struck-through
 * rendering is the UI's job). Returns a new array. */
export function sinkChecked(items: GroceryItem[], checked: Set<string>): GroceryItem[] {
  return [...items].sort((a, b) => {
    const aC = checked.has(a.key) ? 1 : 0;
    const bC = checked.has(b.key) ? 1 : 0;
    return aC - bC;
  });
}

/** Toggle a key in the checked list (unique, order-preserving append). */
export function mergeCheckedState(existing: string[], key: string, on: boolean): string[] {
  const set = new Set(existing);
  if (on) set.add(key);
  else set.delete(key);
  return [...set];
}
