import { calculateBMRKatchMcArdle as _calculateBMRKatchMcArdle } from "./bodyfat";

export const ACTIVITY_LEVELS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extreme: 1.9,
} as const;

export type ActivityLevelKey = keyof typeof ACTIVITY_LEVELS;

export interface MacroPreset {
  name: string;
  protein: number;
  fats: number;
  carbs: number;
  description: string;
}

export const macroPresets: MacroPreset[] = [
  {
    name: "Balance",
    protein: 30,
    fats: 35,
    carbs: 35,
    description: "Balanced diet for general fitness",
  },
  {
    name: "Low Carbs",
    protein: 40,
    fats: 40,
    carbs: 20,
    description: "Low carb, high protein for fat loss",
  },
  {
    name: "High Carbs",
    protein: 30,
    fats: 20,
    carbs: 50,
    description: "High carb for muscle building",
  },
];

/**
 * Calculate BMR using Mifflin-St Jeor equation.
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: "male" | "female"
): number {
  if (!weightKg || !heightCm || !age || !gender) return 0;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === "male" ? base + 5 : base - 161);
}

/** Re-export Katch-McArdle BMR from bodyfat module for convenience. */
export function calculateBMRKatchMcArdle(bodyFatPct: number, weightKg: number): number {
  return _calculateBMRKatchMcArdle(bodyFatPct, weightKg);
}

/**
 * Calculate TDEE from BMR and a canonical activity key.
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevelKey | string): number {
  return Math.round(bmr * (ACTIVITY_LEVELS[activityLevel as ActivityLevelKey] || ACTIVITY_LEVELS.moderate));
}

export function calculateMacros(
  tdee: number,
  preset: MacroPreset
): { protein: number; fats: number; carbs: number } {
  const protein = (tdee * (preset.protein / 100)) / 4;
  const fats = (tdee * (preset.fats / 100)) / 9;
  const carbs = (tdee * (preset.carbs / 100)) / 4;
  return { protein, fats, carbs };
}

export function suggestPresetByBodyFat(bodyFatPercentage: number): MacroPreset {
  if (bodyFatPercentage > 25) {
    return macroPresets[1]; // Low Carbs
  }
  if (bodyFatPercentage >= 15) {
    return macroPresets[0]; // Balance
  }
  return macroPresets[2]; // High Carbs
}

export function activityLabel(key: ActivityLevelKey | string): string {
  const labels: Record<string, string> = {
    sedentary: "Sedentary",
    light: "Lightly active",
    moderate: "Moderately active",
    very: "Very active",
    extreme: "Extremely active",
  };
  return labels[key] ?? key;
}

/* ── Phase 16: goal adjustments + spec diet presets + macro breakdown ── */

/** Calorie adjustments from TDEE per client goal (kcal/day). */
export const GOAL_ADJUSTMENTS = {
  maintenance: 0,
  fat_loss: -500,
  aggressive_fat_loss: -750,
  muscle_gain: 250,
} as const;

export type GoalKey = keyof typeof GOAL_ADJUSTMENTS;

export function calculateGoalCalories(tdee: number, goal: GoalKey | string): number {
  const adj = GOAL_ADJUSTMENTS[goal as GoalKey] ?? GOAL_ADJUSTMENTS.maintenance;
  return Math.max(0, Math.round(tdee + adj));
}

/** Diet preference macro splits (% of calories), per legacy PHASE_2 spec. */
export const DIET_PRESETS = {
  balanced: { label: "Balanced", protein: 30, carbs: 35, fats: 35 },
  low_carb: { label: "Low Carb", protein: 35, carbs: 15, fats: 50 },
  high_carb: { label: "High Carb", protein: 25, carbs: 55, fats: 20 },
  high_protein: { label: "High Protein", protein: 40, carbs: 30, fats: 30 },
} as const;

export type DietKey = keyof typeof DIET_PRESETS;

export interface MacroBreakdown {
  protein: number;
  carbs: number;
  fats: number;
}

/**
 * Macro grams for a calorie target + diet split.
 * Protein uses the HIGHER of the percentage-based value or 1.6 g/kg
 * minimum (legacy spec); carbs/fats come from the remaining split.
 */
export function calculateMacroBreakdown(
  calories: number,
  diet: DietKey | string,
  weightKg: number
): MacroBreakdown {
  const preset = DIET_PRESETS[diet as DietKey] ?? DIET_PRESETS.balanced;
  const proteinFromPercent = (calories * (preset.protein / 100)) / 4;
  const minProtein = weightKg * 1.6;
  const protein = Math.round(Math.max(proteinFromPercent, minProtein));
  const carbs = Math.round((calories * (preset.carbs / 100)) / 4);
  const fats = Math.round((calories * (preset.fats / 100)) / 9);
  return { protein, carbs, fats };
}
