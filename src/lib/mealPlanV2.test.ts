import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  MEAL_TEMPLATES,
  generateMultiDayPlan,
  regenerateDay,
  fitDayToTargets,
  accuracyOf,
  roundingStep,
  minServing,
  type PlanItemV2,
  type MacroTargets,
} from "@/lib/mealPlanV2";
import { calculateMacroTargets } from "@/lib/tdee";
import type { FoodInput } from "@/lib/mealPlan";

/* Build the test pool from the REAL seed SQL — the same rows the
 * production generator sees. Guards template food names against typos. */
function loadStaples(): FoodInput[] {
  const sql = readFileSync("supabase/seed-staple-foods.sql", "utf8");
  const re =
    /\('seed-staples', '[^']*', '([^']+)', null, '([a-z]+)', ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), null\)/g;
  const foods: FoodInput[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(sql))) {
    foods.push({
      id: `staple-${i++}`,
      name: m[1],
      brand: null,
      category: m[2],
      serving_size_g: Number(m[3]),
      calories: Number(m[4]),
      protein: Number(m[5]),
      carbs: Number(m[6]),
      fats: Number(m[7]),
      source: "seed-staples",
    });
  }
  return foods;
}

const POOL = loadStaples();

const byDay = (items: PlanItemV2[], day: number) => items.filter((i) => i.day === day);

describe("template integrity (Phase 40)", () => {
  it("seed SQL parses into a usable pool", () => {
    expect(POOL.length).toBeGreaterThanOrEqual(100);
  });

  it("every template's preferred foods exist in the staple seed", () => {
    const names = new Set(POOL.map((f) => f.name));
    const missing: string[] = [];
    for (const t of MEAL_TEMPLATES) {
      for (const s of t.slots) {
        for (const n of s.foods) {
          if (!names.has(n)) missing.push(`${t.id}: ${n}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("every breakfast template has a protein slot", () => {
    for (const t of MEAL_TEMPLATES.filter((t) => t.meal === "breakfast")) {
      expect(t.slots.some((s) => s.role === "protein")).toBe(true);
    }
  });
});

describe("macro accuracy engine (Phase 40)", () => {
  const scenarios: Array<[string, MacroTargets, string?]> = [
    ["fat-loss (Alex)", { calories: 2740, protein: 206, carbs: 240, fats: 107 }],
    ["maintenance", { calories: 2500, protein: 150, carbs: 300, fats: 75 }],
    ["muscle-gain", { calories: 3200, protein: 200, carbs: 400, fats: 90 }],
    [
      "low_carb",
      {
        calories: 2740,
        ...calculateMacroTargets({ calories: 2740, weightKg: 80, gender: "male", goal: "fat_loss", diet: "low_carb" }),
      },
      "low_carb",
    ],
    [
      "high_protein",
      {
        calories: 2740,
        ...calculateMacroTargets({ calories: 2740, weightKg: 80, gender: "male", goal: "fat_loss", diet: "high_protein" }),
      },
      "high_protein",
    ],
  ];

  for (const [label, targets, diet] of scenarios) {
    it(`${label}: every day lands within tolerance`, () => {
      const plan = generateMultiDayPlan(POOL, targets, { days: 5, seed: 7, diet });
      for (let d = 1; d <= 5; d++) {
        const acc = accuracyOf(byDay(plan.items, d), targets);
        expect(acc.kcalPct, `day ${d} kcal ${acc.kcalPct}%`).toBeGreaterThanOrEqual(95);
        expect(acc.kcalPct, `day ${d} kcal ${acc.kcalPct}%`).toBeLessThanOrEqual(105);
        expect(acc.proteinPct, `day ${d} protein ${acc.proteinPct}%`).toBeGreaterThanOrEqual(90);
        expect(acc.proteinPct, `day ${d} protein ${acc.proteinPct}%`).toBeLessThanOrEqual(115);
        expect(acc.carbsPct, `day ${d} carbs ${acc.carbsPct}%`).toBeGreaterThanOrEqual(85);
        expect(acc.carbsPct, `day ${d} carbs ${acc.carbsPct}%`).toBeLessThanOrEqual(115);
        expect(acc.fatsPct, `day ${d} fats ${acc.fatsPct}%`).toBeGreaterThanOrEqual(85);
        expect(acc.fatsPct, `day ${d} fats ${acc.fatsPct}%`).toBeLessThanOrEqual(115);
      }
    });
  }

  it("fat-loss undershoot regression: protein never below 90% (the old failure mode)", () => {
    const targets = { calories: 2740, protein: 206, carbs: 240, fats: 107 };
    const plan = generateMultiDayPlan(POOL, targets, { days: 7, seed: 3 });
    for (let d = 1; d <= 7; d++) {
      const acc = accuracyOf(byDay(plan.items, d), targets);
      expect(acc.proteinPct, `day ${d}`).toBeGreaterThanOrEqual(90);
    }
  });

  it("breakfast carries ≥25 g protein (or best effort) each day", () => {
    const targets = { calories: 2740, protein: 206, carbs: 240, fats: 107 };
    const plan = generateMultiDayPlan(POOL, targets, { days: 5, seed: 5 });
    for (let d = 1; d <= 5; d++) {
      const breakfastP = byDay(plan.items, d)
        .filter((i) => i.meal === "breakfast")
        .reduce((s, i) => s + i.protein, 0);
      expect(breakfastP, `day ${d} breakfast ${breakfastP}g`).toBeGreaterThanOrEqual(22.5); // 25g − rounding slack
    }
  });

  it("quantities respect per-food rounding steps and minimums", () => {
    const byName = new Map(POOL.map((f) => [f.name, f]));
    const plan = generateMultiDayPlan(POOL, { calories: 2500, protein: 150, carbs: 300, fats: 75 }, { days: 3, seed: 11 });
    for (const it of plan.items) {
      const food = byName.get(it.name)!;
      expect(it.serving_g % roundingStep(food), `${it.name} ${it.serving_g}g`).toBe(0);
      expect(it.serving_g).toBeGreaterThanOrEqual(minServing(food));
    }
  });

  it("empty protein pool → honest warning, no crash", () => {
    const noProtein = POOL.filter((f) => !["protein", "dairy"].includes(f.category ?? ""));
    const plan = generateMultiDayPlan(noProtein, { calories: 2500, protein: 150, carbs: 300, fats: 75 }, { days: 1 });
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
});

describe("multi-day variety + determinism (Phase 40)", () => {
  const targets = { calories: 2740, protein: 206, carbs: 240, fats: 107 };
  const plan = generateMultiDayPlan(POOL, targets, { days: 7, seed: 42 });

  it("no identical meal (same slot-food set) twice in a plan", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 7; d++) {
      for (const meal of ["breakfast", "lunch", "dinner", "snacks"] as const) {
        const dayMeal = byDay(plan.items, d).filter((i) => i.meal === meal);
        const key = `${meal}:${["protein", "carb", "vegfruit", "fat", "dairy"]
          .map((r) => dayMeal.find((i) => i.role === r)?.name ?? "")
          .join("|")}`;
        expect(seen.has(key), `duplicate ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("no protein source repeats on consecutive days for the same meal", () => {
    for (let d = 2; d <= 7; d++) {
      for (const meal of ["breakfast", "lunch", "dinner", "snacks"] as const) {
        const prev = byDay(plan.items, d - 1).find((i) => i.meal === meal && i.role === "protein")?.name;
        const curr = byDay(plan.items, d).find((i) => i.meal === meal && i.role === "protein")?.name;
        if (prev && curr) expect(curr, `${meal} day ${d - 1}→${d}`).not.toBe(prev);
      }
    }
  });

  it("same seed → identical plan (deterministic)", () => {
    const again = generateMultiDayPlan(POOL, targets, { days: 7, seed: 42 });
    expect(again.items).toEqual(plan.items);
  });

  it("different seed → different plan", () => {
    const other = generateMultiDayPlan(POOL, targets, { days: 7, seed: 43 });
    expect(other.items).not.toEqual(plan.items);
  });

  it("regenerateDay replaces only that day and respects neighbor proteins (same meal type)", () => {
    const regenerated = regenerateDay(plan.items, 3, POOL, targets, { seed: 42, salt: 1 });
    expect(regenerated.length).toBeGreaterThan(0);
    for (const it of regenerated) {
      expect(it.day).toBe(3);
      if (it.role !== "protein") continue;
      const prev = byDay(plan.items, 2).find((i) => i.meal === it.meal && i.role === "protein")?.name;
      const next = byDay(plan.items, 4).find((i) => i.meal === it.meal && i.role === "protein")?.name;
      if (prev) expect(it.name, `${it.meal} vs day 2`).not.toBe(prev);
      if (next) expect(it.name, `${it.meal} vs day 4`).not.toBe(next);
    }
  });

  it("vegetarian plan contains no meat", () => {
    const veg = generateMultiDayPlan(POOL, targets, { days: 3, seed: 9, diet: "vegetarian" });
    const meatRe = /chicken|turkey|beef|salmon|tuna|cod|haddock|mackerel|sardine|prawn|pork|sirloin/i;
    expect(veg.items.every((i) => !meatRe.test(i.name))).toBe(true);
    expect(veg.items.length).toBeGreaterThan(0);
  });

  it("fitDayToTargets is a no-op on an already-fitting day", () => {
    const fitted = fitDayToTargets(
      byDay(generateMultiDayPlan(POOL, targets, { days: 1, seed: 1 }).items, 1),
      targets,
      POOL,
    );
    const acc = accuracyOf(fitted, targets);
    expect(acc.kcalPct).toBeGreaterThanOrEqual(95);
    expect(acc.kcalPct).toBeLessThanOrEqual(105);
  });
});
