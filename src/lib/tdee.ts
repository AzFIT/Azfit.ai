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

/**
 * Calorie adjustments from TDEE per client goal (kcal/day).
 * @deprecated flat-kcal model — use GOAL_ADJUSTMENTS_PCT + calculateGoalCaloriesPct (Phase 28E).
 */
export const GOAL_ADJUSTMENTS = {
  maintenance: 0,
  fat_loss: -500,
  aggressive_fat_loss: -750,
  muscle_gain: 250,
} as const;

export type GoalKey = keyof typeof GOAL_ADJUSTMENTS;

/**
 * @deprecated flat-kcal model — use calculateGoalCaloriesPct (Phase 28E).
 */
export function calculateGoalCalories(tdee: number, goal: GoalKey | string): number {
  const adj = GOAL_ADJUSTMENTS[goal as GoalKey] ?? GOAL_ADJUSTMENTS.maintenance;
  return Math.max(0, Math.round(tdee + adj));
}

/* ── Phase 28E: percentage goals, safety guardrails, lean-mass macros ── */

/** Percentage-based goal adjustments (spec Part A). */
export const GOAL_ADJUSTMENTS_PCT = {
  aggressive_fat_loss: -0.20,
  fat_loss: -0.10,
  maintenance: 0,
  lean_gain: 0.05,
  muscle_gain: 0.10,
} as const;

export type GoalKeyPct = keyof typeof GOAL_ADJUSTMENTS_PCT;

export const MAX_KCAL_DELTA = 1000;

/**
 * Percentage-based goal calories: tdee × (1 + pct), delta clamped to
 * ±MAX_KCAL_DELTA, rounded, never below 0.
 * SPEC AMBIGUITY (documented): Part A says "Aggressive −20% (max −1000 cal)"
 * while Part D code applies raw percentages without caps — we implement the
 * Part A reading (percent + ±1000 kcal cap).
 */
export function calculateGoalCaloriesPct(tdee: number, goal: GoalKeyPct | string): number {
  const pct = GOAL_ADJUSTMENTS_PCT[goal as GoalKeyPct] ?? 0;
  const rawDelta = Math.round(tdee * pct);
  const delta = Math.max(-MAX_KCAL_DELTA, Math.min(MAX_KCAL_DELTA, rawDelta));
  return Math.max(0, Math.round(tdee + delta));
}

export interface GuardrailResult {
  calories: number;
  clamped: boolean;
  warnings: string[];
}

/**
 * Safety guardrails: floor = BMR × 1.2, ceiling = TDEE + 1000.
 * Clamps are NEVER silent — a human-readable warning is returned for each.
 */
export function applySafetyGuardrails(
  targetCalories: number,
  bmr: number,
  tdee: number
): GuardrailResult {
  const floor = Math.round(bmr * 1.2);
  const ceiling = Math.round(tdee + MAX_KCAL_DELTA);
  const warnings: string[] = [];
  let calories = targetCalories;
  if (calories < floor) {
    calories = floor;
    warnings.push(`Target raised to BMR × 1.2 safety floor: ${floor.toLocaleString()} kcal`);
  }
  if (calories > ceiling) {
    calories = ceiling;
    warnings.push(`Target lowered to TDEE + 1000 safety ceiling: ${ceiling.toLocaleString()} kcal`);
  }
  return { calories, clamped: warnings.length > 0, warnings };
}

/**
 * Full 28E nutrition pipeline in one call (Phase 33D — shared by the intake
 * wizard so it can never drift from TdeeCalculator's inline chain):
 * BMR → TDEE → pct goal (±1000 cap) → safety guardrails → D6 macros.
 */
export function calculateNutritionPipeline(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: "male" | "female";
  activity: ActivityLevelKey | string;
  goal: GoalKeyPct | string;
  diet?: string;
  bodyFatPct?: number;
  trainingDaysPerWeek?: number;
  kidneyConcern?: boolean;
}): {
  bmr: number;
  tdee: number;
  goalCalories: number;
  guard: GuardrailResult;
  macros: MacroTargetsAdvanced;
} {
  const bmr = calculateBMR(input.weightKg, input.heightCm, input.age, input.gender);
  const tdee = calculateTDEE(bmr, input.activity);
  const guard = applySafetyGuardrails(calculateGoalCaloriesPct(tdee, input.goal), bmr, tdee);
  const macros = calculateMacroTargets({
    calories: guard.calories,
    weightKg: input.weightKg,
    bodyFatPct: input.bodyFatPct,
    gender: input.gender,
    goal: input.goal,
    diet: input.diet,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    kidneyConcern: input.kidneyConcern,
  });
  return { bmr, tdee, goalCalories: guard.calories, guard, macros };
}

export interface MacroTargetsAdvanced {
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  waterMl: number;
  proteinPerKgLbm: number;
}

/**
 * Lean-mass protein-first macro algorithm (spec D6, Phase 28E).
 * 1. Protein on lean mass (LBM = weight × (1 − BF%), or weight × 0.8 when BF
 *    unknown): 2.0 g/kg LBM base; 2.2 if BF>25% OR goal in
 *    (muscle_gain, lean_gain, aggressive_fat_loss); else 1.8 if BF<12% OR
 *    vegetarian/vegan; +0.2 for high_protein (Phase 39); hard-capped at
 *    1.6 when kidneyConcern; protein also capped at 35% of total kcal.
 * 2. Fats/carbs split of the remainder (Phase 39 diet-aware):
 *    low_carb — carbs ≤ ~20% of total kcal, fats absorb the remainder;
 *    high_carb — fats ≈ 20% of total kcal (never below the floor), carbs
 *    absorb the remainder; anything else — fats 25% of remaining kcal,
 *    floored at 0.6 g/kg total weight and (female) 25% of total kcal,
 *    carbs fill the rest.
 * 3. Fiber: 14 g per 1000 kcal, floored at 25 g (female) / 38 g (male).
 * 4. Water: 35 ml/kg + 500 ml per training day (default 3), rounded to 50 ml.
 */
export function calculateMacroTargets(input: {
  calories: number;
  weightKg: number;
  bodyFatPct?: number;
  gender: "male" | "female";
  goal: string;
  diet?: string;
  trainingDaysPerWeek?: number;
  kidneyConcern?: boolean;
}): MacroTargetsAdvanced {
  const {
    calories,
    weightKg,
    bodyFatPct,
    gender,
    goal,
    diet,
    trainingDaysPerWeek = 3,
    kidneyConcern = false,
  } = input;

  // 1 — protein on lean mass
  const lbm =
    bodyFatPct != null && bodyFatPct > 0 && bodyFatPct < 100
      ? weightKg * (1 - bodyFatPct / 100)
      : weightKg * 0.8;
  let multiplier = 2.0;
  if (
    (bodyFatPct != null && bodyFatPct > 25) ||
    goal === "muscle_gain" ||
    goal === "lean_gain" ||
    goal === "aggressive_fat_loss"
  ) {
    multiplier = 2.2;
  } else if (
    (bodyFatPct != null && bodyFatPct > 0 && bodyFatPct < 12) ||
    diet === "vegetarian" ||
    diet === "vegan"
  ) {
    multiplier = 1.8;
  }
  if (diet === "high_protein") multiplier += 0.2; // Phase 39 — still capped below
  if (kidneyConcern) multiplier = Math.min(multiplier, 1.6);
  const proteinPerKgLbm = multiplier;
  let protein = lbm * multiplier;
  const proteinKcalCap = calories * 0.35;
  if (protein * 4 > proteinKcalCap) protein = proteinKcalCap / 4;
  protein = Math.round(protein);

  // 2+3 — fats/carbs split of the remaining kcal (diet-aware, Phase 39).
  // balanced/undefined/vegetarian/vegan: identical to the pre-39 behavior
  // (fats 25% of remaining, floors, carbs fill the rest).
  const remainingKcal = Math.max(0, calories - protein * 4);
  const fatFloorG = Math.max(
    weightKg * 0.6,
    gender === "female" ? (calories * 0.25) / 9 : 0,
  );
  let fatG: number;
  let carbsG: number;
  if (diet === "low_carb") {
    // carbs capped at ~20% of total kcal; fats absorb the remainder.
    // Carbs must still leave room for the fat floor; if kcal are so low
    // that even carbs=0 can't fund the floor, kcal consistency wins
    // (documented — same corner the pre-39 code overspent in).
    const carbCapG = (calories * 0.2) / 4;
    carbsG = Math.min(
      carbCapG,
      Math.max(0, (calories - protein * 4 - fatFloorG * 9) / 4),
    );
    fatG = Math.max(0, calories - protein * 4 - carbsG * 4) / 9;
  } else if (diet === "high_carb") {
    // fats capped at ~20% of total kcal, NEVER below the floor; carbs
    // absorb the remainder.
    const fatCapG = (calories * 0.2) / 9;
    fatG = Math.min(Math.max(fatCapG, fatFloorG), remainingKcal / 9);
    carbsG = Math.max(0, calories - protein * 4 - fatG * 9) / 4;
  } else {
    fatG = Math.max((remainingKcal * 0.25) / 9, fatFloorG);
    carbsG = Math.max(0, calories - protein * 4 - fatG * 9) / 4;
  }
  const fats = Math.round(fatG);
  const carbs = Math.round(carbsG);

  // 4 — fiber
  const fiber = Math.round(Math.max((calories / 1000) * 14, gender === "female" ? 25 : 38));

  // 5 — water
  const waterMl = Math.round((35 * weightKg + 500 * trainingDaysPerWeek) / 50) * 50;

  return { protein, carbs, fats, fiber, waterMl, proteinPerKgLbm };
}

/** Diet preference macro splits (% of calories), per legacy PHASE_2 spec.
 * Phase 39: vegetarian/vegan added so both diet dropdowns (TdeeCalculator
 * + intake wizard, both map over this object) offer them — the D6 protein
 * ladder already handles them (1.8 g/kg LBM); their split stays balanced. */
export const DIET_PRESETS = {
  balanced: { label: "Balanced", protein: 30, carbs: 35, fats: 35 },
  low_carb: { label: "Low Carb", protein: 35, carbs: 15, fats: 50 },
  high_carb: { label: "High Carb", protein: 25, carbs: 55, fats: 20 },
  high_protein: { label: "High Protein", protein: 40, carbs: 30, fats: 30 },
  vegetarian: { label: "Vegetarian", protein: 30, carbs: 35, fats: 35 },
  vegan: { label: "Vegan", protein: 30, carbs: 35, fats: 35 },
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
 * @deprecated simple mode — use calculateMacroTargets (Phase 28E lean-mass algorithm).
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
