import { describe, it, expect } from "vitest";
import { programWeek, mealPlanDays, stepsSleepFromHabits, goalKeysForSupplements } from "./planPackPrint";
import { supplementsForGoals, SUPPLEMENTS } from "./supplements";

describe("programWeek (Week X of Y)", () => {
  const today = new Date(2026, 7, 7); // Aug 7 2026 (local)
  it("null when no start_date → 'Not started'", () => {
    expect(programWeek(null, 8, today)).toBeNull();
    expect(programWeek(undefined, 8, today)).toBeNull();
    expect(programWeek("not-a-date", 8, today)).toBeNull();
  });
  it("start today → week 1", () => {
    expect(programWeek("2026-08-07", 8, today)).toEqual({ week: 1, total: 8 });
  });
  it("mid-program derivation", () => {
    expect(programWeek("2026-07-20", 8, today)).toEqual({ week: 3, total: 8 }); // 18 days in
  });
  it("clamps to duration after the end", () => {
    expect(programWeek("2026-01-01", 4, today)).toEqual({ week: 4, total: 4 });
  });
  it("future start_date → week 0 ('Starts …'), never a fake week 1", () => {
    expect(programWeek("2026-09-01", 6, today)).toEqual({ week: 0, total: 6 });
  });
});

describe("mealPlanDays", () => {
  const items = [
    { day: 1, meal: "breakfast", name: "Oats", calories: 300, protein: 10, carbs: 50, fats: 6 },
    { day: 1, meal: "lunch", name: "Chicken + rice", calories: 600, protein: 45, carbs: 70, fats: 12 },
    { day: 1, meal: "lunch", name: "Salad", calories: 80, protein: 2, carbs: 8, fats: 4 },
    { day: 2, meal: "breakfast", name: "Eggs", calories: 350, protein: 24, carbs: 2, fats: 26 },
  ];
  const days = mealPlanDays(items);

  it("groups by day, sorted", () => {
    expect(days.map((d) => d.day)).toEqual([1, 2]);
  });
  it("meals follow MEAL_ORDER and aggregate per meal", () => {
    expect(days[0].meals.map((m) => m.meal)).toEqual(["breakfast", "lunch"]);
    expect(days[0].meals[1].items).toHaveLength(2);
    expect(days[0].meals[1].totals).toEqual({ calories: 680, protein: 47, carbs: 78, fats: 16 });
  });
  it("day totals sum all items", () => {
    expect(days[0].totals).toEqual({ calories: 980, protein: 57, carbs: 128, fats: 22 });
    expect(days[1].totals).toEqual({ calories: 350, protein: 24, carbs: 2, fats: 26 });
  });
  it("missing day → day 1 (V1 plans); missing meal → snacks", () => {
    const v1 = mealPlanDays([{ name: "Loose item", calories: 100 }]);
    expect(v1).toHaveLength(1);
    expect(v1[0].day).toBe(1);
    expect(v1[0].meals[0].meal).toBe("snacks");
  });
  it("empty plan → no days", () => {
    expect(mealPlanDays([])).toEqual([]);
  });
});

describe("supplementsForGoals", () => {
  it("muscle gain → creatine + whey (curated order)", () => {
    const names = supplementsForGoals(["build_muscle"]).map((s) => s.name);
    expect(names[0]).toBe("Creatine Monohydrate");
    expect(names).toContain("Whey Protein");
    expect(names).toContain("Omega-3 (EPA/DHA)"); // general
  });
  it("fat loss → no creatine, keeps whey + omega-3", () => {
    const names = supplementsForGoals(["lose_weight"]).map((s) => s.name);
    expect(names).not.toContain("Creatine Monohydrate");
    expect(names).toContain("Whey Protein");
    expect(names).toContain("Omega-3 (EPA/DHA)");
  });
  it("no goals → general set only", () => {
    const names = supplementsForGoals([]).map((s) => s.name);
    expect(names).toEqual(SUPPLEMENTS.filter((s) => s.goals.includes("general")).map((s) => s.name));
  });
  it("multiple goals → union without duplicates", () => {
    const names = supplementsForGoals(["build_muscle", "lose_weight"]).map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("Creatine Monohydrate");
    expect(names).toContain("Omega-3 (EPA/DHA)");
  });
});

describe("goalKeysForSupplements", () => {
  it("client_goals rows win over fitness_goal", () => {
    expect(goalKeysForSupplements([{ goal_type: "lose_weight" }], "build_muscle")).toEqual(["lose_weight"]);
  });
  it("goal_type vocab passes through", () => {
    expect(goalKeysForSupplements([], "increase_strength")).toEqual(["increase_strength"]);
  });
  it("wizard vocab maps to goal_type", () => {
    expect(goalKeysForSupplements([], "strength")).toEqual(["increase_strength"]);
    expect(goalKeysForSupplements([], "endurance")).toEqual(["improve_fitness"]);
  });
  it("nothing set → empty (general supplement set)", () => {
    expect(goalKeysForSupplements([], null)).toEqual([]);
  });
});

describe("stepsSleepFromHabits", () => {
  it("surfaces matching active habits verbatim", () => {
    const r = stepsSleepFromHabits([
      { name: "10k steps daily", target_frequency: "Daily", active: true },
      { name: "Sleep 8h", target_frequency: null, active: true },
    ]);
    expect(r.steps).toBe("10k steps daily — Daily");
    expect(r.sleep).toBe("Sleep 8h");
  });
  it("inactive or absent habits → null (row omitted)", () => {
    expect(stepsSleepFromHabits([{ name: "10k steps", target_frequency: "Daily", active: false }])).toEqual({
      steps: null,
      sleep: null,
    });
    expect(stepsSleepFromHabits([])).toEqual({ steps: null, sleep: null });
  });
});
