// ═══════════════════════════════════════════════════════════════
// planBlueprintInput (Phase 79 Item 3) — typed state for the client
// "Smart Blueprint" INPUT panel. Pure: no supabase imports — the
// hook/component wires persistence. Serialization round-trips
// cleanly to the client_plan_blueprints jsonb columns.
// (Named planBlueprintInput because src/lib/planBlueprint.ts is the
// Phase 61 report engine — a different concern.)
// ═══════════════════════════════════════════════════════════════

export const EQUIPMENT_OPTIONS = [
  { value: "full_gym", label: "Full Commercial Gym" },
  { value: "home_gym_bb_db", label: "Home Gym — Barbell + Dumbbells" },
  { value: "dumbbells_only", label: "Dumbbells Only" },
  { value: "bodyweight_only", label: "Bodyweight Only" },
] as const;
export type EquipmentAccess = (typeof EQUIPMENT_OPTIONS)[number]["value"];

export const DIET_OPTIONS = [
  { value: "none", label: "None" },
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "dairy_free", label: "Dairy-Free" },
  { value: "gluten_free", label: "Gluten-Free" },
] as const;
export type DietaryRestriction = (typeof DIET_OPTIONS)[number]["value"];

export const MEAL_CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
  "refeed",
  "cheat_day",
] as const;
export type MealCategory = (typeof MEAL_CATEGORIES)[number];

export const MEAL_CATEGORY_LABELS: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
  refeed: "Refeed",
  cheat_day: "Cheat Day",
};

export interface PlanBlueprintInput {
  equipmentAccess: EquipmentAccess | null;
  injuriesNotes: string;
  stressLevel: number | null; // 1–10
  sleepQuality: number | null; // 1–10
  dietaryRestriction: DietaryRestriction | null;
  dietPreferences: {
    included: string[];
    excluded: string[];
    meals: Record<MealCategory, string[]>;
  };
}

export const EMPTY_BLUEPRINT: PlanBlueprintInput = {
  equipmentAccess: null,
  injuriesNotes: "",
  stressLevel: null,
  sleepQuality: null,
  dietaryRestriction: null,
  dietPreferences: {
    included: [],
    excluded: [],
    meals: {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
      refeed: [],
      cheat_day: [],
    },
  },
};

/** DB row shape (client_plan_blueprints). */
export interface BlueprintRow {
  id: string;
  client_id: string;
  equipment_access: string | null;
  injuries_notes: string | null;
  stress_level: number | null;
  sleep_quality: number | null;
  dietary_restriction: string | null;
  food_include: string[];
  food_exclude: string[];
  meal_preferences: Record<string, string[]>;
}

const EQUIPMENT_VALUES = new Set<string>(EQUIPMENT_OPTIONS.map((o) => o.value));
const DIET_VALUES = new Set<string>(DIET_OPTIONS.map((o) => o.value));

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Row → typed state. Unknown enum values degrade to null (never throw
 *  on legacy/foreign data); meals fill missing categories with []. */
export function blueprintFromRow(row: BlueprintRow): PlanBlueprintInput {
  const meals = { ...EMPTY_BLUEPRINT.dietPreferences.meals };
  for (const cat of MEAL_CATEGORIES) {
    meals[cat] = asStringArray(row.meal_preferences?.[cat]);
  }
  return {
    equipmentAccess:
      row.equipment_access && EQUIPMENT_VALUES.has(row.equipment_access)
        ? (row.equipment_access as EquipmentAccess)
        : null,
    injuriesNotes: row.injuries_notes ?? "",
    stressLevel: row.stress_level,
    sleepQuality: row.sleep_quality,
    dietaryRestriction:
      row.dietary_restriction && DIET_VALUES.has(row.dietary_restriction)
        ? (row.dietary_restriction as DietaryRestriction)
        : null,
    dietPreferences: {
      included: asStringArray(row.food_include),
      excluded: asStringArray(row.food_exclude),
      meals,
    },
  };
}

/** Typed state → DB payload (jsonb columns are plain string arrays /
 *  Record<category, string[]> — JSON-serializable by construction). */
export function blueprintToPayload(b: PlanBlueprintInput): {
  equipment_access: string | null;
  injuries_notes: string | null;
  stress_level: number | null;
  sleep_quality: number | null;
  dietary_restriction: string | null;
  food_include: string[];
  food_exclude: string[];
  meal_preferences: Record<string, string[]>;
  updated_at: string;
} {
  return {
    equipment_access: b.equipmentAccess,
    injuries_notes: b.injuriesNotes.trim() || null,
    stress_level: b.stressLevel,
    sleep_quality: b.sleepQuality,
    dietary_restriction: b.dietaryRestriction,
    food_include: b.dietPreferences.included,
    food_exclude: b.dietPreferences.excluded,
    meal_preferences: b.dietPreferences.meals,
    updated_at: new Date().toISOString(),
  };
}

/** Toggle helper for chip multi-selects (immutable). */
export function toggleInList(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
