import { describe, it, expect } from "vitest";
import {
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroBreakdown,
  calculateGoalCaloriesPct,
  applySafetyGuardrails,
  calculateMacroTargets,
  calculateNutritionPipeline,
  GOAL_ADJUSTMENTS,
  GOAL_ADJUSTMENTS_PCT,
  MAX_KCAL_DELTA,
  DIET_PRESETS,
} from "@/lib/tdee";

describe("tdee", () => {
  // 80 kg, 180 cm, 30 yo male, moderate activity
  // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
  // TDEE = 1780 * 1.55 = 2759
  it("computes Mifflin-St Jeor BMR for a male", () => {
    expect(calculateBMR(80, 180, 30, "male")).toBe(1780);
  });

  it("computes Mifflin-St Jeor BMR for a female", () => {
    // 800 + 1125 - 150 - 161 = 1614
    expect(calculateBMR(80, 180, 30, "female")).toBe(1614);
  });

  it("computes TDEE with the activity multiplier within ±1%", () => {
    const bmr = calculateBMR(80, 180, 30, "male");
    const tdee = calculateTDEE(bmr, "moderate");
    expect(tdee).toBe(2759);
    expect(Math.abs(tdee - 1780 * 1.55) / (1780 * 1.55)).toBeLessThan(0.01);
  });

  it("applies all goal adjustments", () => {
    const tdee = 2759;
    expect(calculateGoalCalories(tdee, "maintenance")).toBe(2759);
    expect(calculateGoalCalories(tdee, "fat_loss")).toBe(2259);
    expect(calculateGoalCalories(tdee, "aggressive_fat_loss")).toBe(2009);
    expect(calculateGoalCalories(tdee, "muscle_gain")).toBe(3009);
    expect(GOAL_ADJUSTMENTS.fat_loss).toBe(-500);
    expect(GOAL_ADJUSTMENTS.aggressive_fat_loss).toBe(-750);
    expect(GOAL_ADJUSTMENTS.muscle_gain).toBe(250);
  });

  it("has the four spec diet presets", () => {
    expect(DIET_PRESETS.balanced).toMatchObject({ protein: 30, carbs: 35, fats: 35 });
    expect(DIET_PRESETS.low_carb).toMatchObject({ protein: 35, carbs: 15, fats: 50 });
    expect(DIET_PRESETS.high_carb).toMatchObject({ protein: 25, carbs: 55, fats: 20 });
    expect(DIET_PRESETS.high_protein).toMatchObject({ protein: 40, carbs: 30, fats: 30 });
  });

  it("computes macro breakdown for each diet preset at 2759 kcal / 80 kg", () => {
    // Balanced: protein max(2759*0.30/4=206.9, 80*1.6=128) = 207
    const balanced = calculateMacroBreakdown(2759, "balanced", 80);
    expect(balanced.protein).toBe(207);
    expect(balanced.carbs).toBe(Math.round((2759 * 0.35) / 4));
    expect(balanced.fats).toBe(Math.round((2759 * 0.35) / 9));

    // Low carb
    const lowCarb = calculateMacroBreakdown(2759, "low_carb", 80);
    expect(lowCarb.protein).toBe(Math.round(Math.max((2759 * 0.35) / 4, 128)));
    expect(lowCarb.carbs).toBe(Math.round((2759 * 0.15) / 4));
    expect(lowCarb.fats).toBe(Math.round((2759 * 0.5) / 9));

    // High carb
    const highCarb = calculateMacroBreakdown(2759, "high_carb", 80);
    expect(highCarb.carbs).toBe(Math.round((2759 * 0.55) / 4));

    // High protein
    const highProtein = calculateMacroBreakdown(2759, "high_protein", 80);
    expect(highProtein.protein).toBe(Math.round(Math.max((2759 * 0.4) / 4, 128)));
  });

  it("enforces the 1.6 g/kg minimum protein when percentages are too low", () => {
    // 1200 kcal balanced: percent protein = 90 g, but 100 kg * 1.6 = 160 g
    const result = calculateMacroBreakdown(1200, "balanced", 100);
    expect(result.protein).toBe(160);
  });
});

describe("Phase 28E — calculateGoalCaloriesPct", () => {
  it("applies percentage deltas per goal", () => {
    expect(calculateGoalCaloriesPct(2500, "maintenance")).toBe(2500);
    expect(calculateGoalCaloriesPct(2500, "aggressive_fat_loss")).toBe(2000); // −20%
    expect(calculateGoalCaloriesPct(2500, "fat_loss")).toBe(2250); // −10%
    expect(calculateGoalCaloriesPct(2500, "lean_gain")).toBe(2625); // +5%
    expect(calculateGoalCaloriesPct(2500, "muscle_gain")).toBe(2750); // +10%
  });

  it("clamps the delta to ±MAX_KCAL_DELTA (Part A cap)", () => {
    expect(MAX_KCAL_DELTA).toBe(1000);
    expect(calculateGoalCaloriesPct(6000, "aggressive_fat_loss")).toBe(5000); // −20% = −1200 → capped
    expect(calculateGoalCaloriesPct(12000, "muscle_gain")).toBe(13000); // +10% = +1200 → capped
  });

  it("never goes below 0 and ignores unknown goals", () => {
    expect(calculateGoalCaloriesPct(0, "aggressive_fat_loss")).toBe(0);
    expect(calculateGoalCaloriesPct(2500, "nonsense")).toBe(2500);
  });

  it("has all five goals including lean_gain", () => {
    expect(Object.keys(GOAL_ADJUSTMENTS_PCT)).toEqual([
      "aggressive_fat_loss",
      "fat_loss",
      "maintenance",
      "lean_gain",
      "muscle_gain",
    ]);
  });
});

describe("Phase 28E — applySafetyGuardrails", () => {
  // BMR 1400 → floor 1680; TDEE 2200 → ceiling 3200
  it("raises targets below BMR × 1.2 with a warning", () => {
    const r = applySafetyGuardrails(1300, 1400, 2200);
    expect(r.calories).toBe(1680);
    expect(r.clamped).toBe(true);
    expect(r.warnings[0]).toContain("BMR × 1.2 safety floor");
    expect(r.warnings[0]).toContain("1,680");
  });

  it("lowers targets above TDEE + 1000 with a warning", () => {
    const r = applySafetyGuardrails(4000, 1400, 2200);
    expect(r.calories).toBe(3200);
    expect(r.clamped).toBe(true);
    expect(r.warnings[0]).toContain("TDEE + 1000 safety ceiling");
  });

  it("passes in-range targets through untouched", () => {
    const r = applySafetyGuardrails(2200, 1400, 2200);
    expect(r).toEqual({ calories: 2200, clamped: false, warnings: [] });
  });
});

describe("Phase 28E — calculateMacroTargets", () => {
  const base = { calories: 2500, weightKg: 80, gender: "male" as const, goal: "maintenance" };

  it("base multiplier 2.0 g/kg LBM with BF known (LBM = 80 × 0.8 = 64 → 128 g)", () => {
    const r = calculateMacroTargets({ ...base, bodyFatPct: 20 });
    expect(r.proteinPerKgLbm).toBe(2.0);
    expect(r.protein).toBe(128); // 64 × 2.0
  });

  it("uses weight × 0.8 when BF is unknown", () => {
    const r = calculateMacroTargets(base);
    expect(r.protein).toBe(128); // LBM = 64 either way at 80 kg
  });

  it("2.2 multiplier when BF > 25%", () => {
    const r = calculateMacroTargets({ ...base, bodyFatPct: 30, goal: "fat_loss" });
    expect(r.proteinPerKgLbm).toBe(2.2);
    expect(r.protein).toBe(Math.round(80 * 0.7 * 2.2)); // 123
  });

  it("2.2 multiplier for muscle_gain / lean_gain / aggressive_fat_loss goals", () => {
    for (const goal of ["muscle_gain", "lean_gain", "aggressive_fat_loss"]) {
      expect(calculateMacroTargets({ ...base, bodyFatPct: 15, goal }).proteinPerKgLbm).toBe(2.2);
    }
  });

  it("1.8 multiplier when BF < 12% or vegetarian/vegan", () => {
    expect(calculateMacroTargets({ ...base, bodyFatPct: 10 }).proteinPerKgLbm).toBe(1.8);
    expect(calculateMacroTargets({ ...base, diet: "vegetarian" }).proteinPerKgLbm).toBe(1.8);
    expect(calculateMacroTargets({ ...base, diet: "vegan" }).proteinPerKgLbm).toBe(1.8);
  });

  it("kidney concern hard-caps the multiplier at 1.6 even when 2.2 applies", () => {
    const r = calculateMacroTargets({ ...base, bodyFatPct: 30, goal: "muscle_gain", kidneyConcern: true });
    expect(r.proteinPerKgLbm).toBe(1.6);
    expect(r.protein).toBe(Math.round(80 * 0.7 * 1.6)); // 90
  });

  it("caps protein at 35% of total kcal", () => {
    // 1000 kcal: 2.0 × 64 = 128 g = 512 kcal > 350 → capped at 87.5 → 88
    const r = calculateMacroTargets({ ...base, calories: 1000 });
    expect(r.protein).toBe(88);
    expect(r.protein * 4).toBeLessThanOrEqual(1000 * 0.35 + 4); // rounding tolerance
  });

  it("fat floor 0.6 g/kg total weight", () => {
    // 1600 kcal, 100 kg: 25% of remaining is small; floor 60 g applies
    const r = calculateMacroTargets({ calories: 1600, weightKg: 100, gender: "male", goal: "maintenance", bodyFatPct: 20 });
    expect(r.fats).toBeGreaterThanOrEqual(60);
  });

  it("female fat minimum 25% of total kcal", () => {
    const r = calculateMacroTargets({ calories: 2000, weightKg: 60, gender: "female", goal: "maintenance", bodyFatPct: 22 });
    expect(r.fats * 9).toBeGreaterThanOrEqual(2000 * 0.25 - 9); // rounding tolerance
  });

  it("carbs fill the remainder", () => {
    const r = calculateMacroTargets(base);
    expect(r.protein * 4 + r.carbs * 4 + r.fats * 9).toBeGreaterThan(2500 - 60);
    expect(r.carbs).toBeGreaterThan(0);
  });

  it("fiber: 14 g/1000 kcal floored at 25 (female) / 38 (male)", () => {
    expect(calculateMacroTargets(base).fiber).toBe(38); // 35 → floor 38
    expect(calculateMacroTargets({ ...base, calories: 3000 }).fiber).toBe(42); // 14×3
    expect(calculateMacroTargets({ ...base, gender: "female", calories: 1400 }).fiber).toBe(25);
  });

  it("water: 35 ml/kg + 500 ml per training day, rounded to 50 ml", () => {
    // 80 kg, 3 days default: 2800 + 1500 = 4300
    expect(calculateMacroTargets(base).waterMl).toBe(4300);
    // 60 kg, 5 days: 2100 + 2500 = 4600
    expect(calculateMacroTargets({ ...base, weightKg: 60, trainingDaysPerWeek: 5 }).waterMl).toBe(4600);
    // rounding: 77 kg → 2695 + 1500 = 4195 → 4200
    expect(calculateMacroTargets({ ...base, weightKg: 77 }).waterMl).toBe(4200);
  });
});

describe("Phase 33D — calculateNutritionPipeline (wizard parity with TdeeCalculator)", () => {
  // Shared fixture (the audit's hand-check): Alex — 80 kg, 178 cm, 30 yo male, moderate
  const fixture = { weightKg: 80, heightCm: 178, age: 30, gender: "male" as const, activity: "moderate", goal: "maintenance" };

  it("matches the audit's hand-computed values", () => {
    const p = calculateNutritionPipeline(fixture);
    expect(p.bmr).toBe(1768);
    expect(p.tdee).toBe(2740);
    expect(p.goalCalories).toBe(2740);
    expect(p.guard.clamped).toBe(false);
    expect(p.macros.protein).toBe(128); // 2.0 × 64 LBM
    expect(p.macros.fats).toBe(62);
    expect(p.macros.carbs).toBe(418);
    expect(p.macros.fiber).toBe(38);
    expect(p.macros.waterMl).toBe(4300);
  });

  it("is byte-identical to TdeeCalculator's inline chain", () => {
    // Exactly what TdeeCalculator.tsx does in its result memo
    const bmr = calculateBMR(fixture.weightKg, fixture.heightCm, fixture.age, fixture.gender);
    const tdee = calculateTDEE(bmr, fixture.activity);
    const goalCalories = calculateGoalCaloriesPct(tdee, fixture.goal);
    const guard = applySafetyGuardrails(goalCalories, bmr, tdee);
    const macros = calculateMacroTargets({
      calories: guard.calories,
      weightKg: fixture.weightKg,
      gender: fixture.gender,
      goal: fixture.goal,
    });

    const p = calculateNutritionPipeline(fixture);
    expect(p.goalCalories).toBe(guard.calories);
    expect(p.macros).toEqual(macros);
  });

  it("applies the guardrail with a visible warning when forced below BMR × 1.2", () => {
    const p = calculateNutritionPipeline({ ...fixture, activity: "sedentary", goal: "aggressive_fat_loss" });
    expect(p.guard.clamped).toBe(true);
    expect(p.goalCalories).toBe(Math.round(p.bmr * 1.2));
    expect(p.guard.warnings[0]).toContain("BMR × 1.2 safety floor");
  });

  it("pct goal with lean_gain (+5%) matches the calculator's goal set", () => {
    const p = calculateNutritionPipeline({ ...fixture, goal: "lean_gain" });
    expect(p.goalCalories).toBe(Math.round(2740 * 1.05));
  });
});
