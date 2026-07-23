import { describe, it, expect } from "vitest";
import {
  calculateBMR,
  calculateTDEE,
  calculateGoalCalories,
  calculateMacroBreakdown,
  GOAL_ADJUSTMENTS,
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
