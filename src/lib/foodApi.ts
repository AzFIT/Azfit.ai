// ═══════════════════════════════════════════════════════════════════════
// Nutrition food API — Open Food Facts + Supabase cache/logs
// No external deps: fetch only.
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  servingSize: number;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
}

export interface CustomFoodInput {
  name: string;
  category?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  serving_size_g?: number;
}

type FoodsCacheRow = Database["public"]["Tables"]["foods_cache"]["Row"];

const OFF_SEARCH_URL =
  "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,brands,categories,nutriments";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function firstCategory(categories: unknown): string | null {
  if (typeof categories !== "string" || !categories) return null;
  const first = categories.split(",")[0]?.trim();
  return first || null;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  nutriments?: Record<string, unknown>;
}

/**
 * Map an Open Food Facts product to a foods_cache row shape.
 * Returns null when the product has no name or no kcal data.
 */
export function normalizeOFFProduct(
  p: OffProduct
): Omit<FoodsCacheRow, "id" | "created_at" | "created_by"> | null {
  const name = (p.product_name || "").trim();
  if (!name) return null;

  const nutriments = p.nutriments || {};
  const calories = num(nutriments["energy-kcal_100g"] ?? nutriments["energy-kcal"] ?? 0);
  if (calories <= 0) return null;

  return {
    source: "off",
    source_id: p.code || null,
    name,
    brand: p.brands || null,
    category: firstCategory(p.categories),
    serving_size_g: 100,
    calories,
    protein: num(nutriments["proteins_100g"]),
    carbs: num(nutriments["carbohydrates_100g"]),
    fats: num(nutriments["fat_100g"]),
    raw: p as unknown as FoodsCacheRow["raw"],
  };
}

function rowToFoodItem(row: FoodsCacheRow): FoodItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category || "Other",
    servingSize: row.serving_size_g ?? 100,
    calories: row.calories,
    protein: row.protein,
    fats: row.fats,
    carbs: row.carbs,
  };
}

async function fetchFromCache(query: string): Promise<FoodsCacheRow[]> {
  const { data, error } = await supabase
    .from("foods_cache")
    .select("*")
    .ilike("name", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data as FoodsCacheRow[]) || [];
}

async function fetchFromOFF(query: string): Promise<OffProduct[]> {
  const url = `${OFF_SEARCH_URL}&search_terms=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return (json?.products as OffProduct[]) || [];
}

async function upsertOffProducts(products: OffProduct[]): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const rows = products
    .map(normalizeOFFProduct)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ ...r, created_by: userId }));
  if (rows.length === 0) return;

  await supabase
    .from("foods_cache")
    .upsert(rows as Database["public"]["Tables"]["foods_cache"]["Insert"][], {
      onConflict: "source,source_id",
      ignoreDuplicates: true,
    });
}

export async function searchFoods(query: string): Promise<FoodItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let cached = await fetchFromCache(trimmed);

  if (cached.length < 5) {
    try {
      const products = await fetchFromOFF(trimmed);
      await upsertOffProducts(products);
      cached = await fetchFromCache(trimmed);
    } catch {
      // OFF unreachable — return whatever we have from cache
    }
  }

  return cached.map(rowToFoodItem);
}

export async function addCustomFood(input: CustomFoodInput): Promise<FoodItem> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("foods_cache")
    .insert({
      source: "custom",
      source_id: null,
      name: input.name,
      category: input.category || null,
      serving_size_g: input.serving_size_g ?? 100,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fats: input.fats,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToFoodItem(data as FoodsCacheRow);
}

/* ── Daily nutrition log ─────────────────────────────────── */

export interface LoggedFoodEntry {
  id: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snacks";
  quantity: number;
  food: FoodItem;
}

export interface DailyNutritionLog {
  date: string;
  entries: LoggedFoodEntry[];
  waterIntake: number;
}

export async function getDailyLog(date: string): Promise<DailyNutritionLog> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { date, entries: [], waterIntake: 0 };

  const { data, error } = await supabase
    .from("nutrition_logs")
    .select("id, meal_type, quantity_g, food:foods_cache(*)")
    .eq("user_id", userId)
    .eq("logged_date", date)
    .order("created_at", { ascending: true });

  if (error || !data) return { date, entries: [], waterIntake: 0 };

  const entries: LoggedFoodEntry[] = (data as unknown as Array<{
    id: string;
    meal_type: LoggedFoodEntry["mealType"];
    quantity_g: number;
    food: FoodsCacheRow | FoodsCacheRow[] | null;
  }>).map((row) => {
    const foodRow = Array.isArray(row.food) ? row.food[0] : row.food;
    return {
      id: row.id,
      mealType: row.meal_type,
      quantity: row.quantity_g,
      food: foodRow ? rowToFoodItem(foodRow) : ({} as FoodItem),
    };
  });

  return { date, entries, waterIntake: 0 };
}

export async function addFoodToLog(
  mealType: LoggedFoodEntry["mealType"],
  foodId: string,
  quantityG: number,
  date: string
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { error } = await supabase.from("nutrition_logs").insert({
    user_id: userId,
    logged_date: date,
    meal_type: mealType,
    food_id: foodId,
    quantity_g: quantityG,
  });

  if (error) throw error;
}

export async function removeFoodFromLog(logId: string): Promise<void> {
  const { error } = await supabase.from("nutrition_logs").delete().eq("id", logId);
  if (error) throw error;
}
