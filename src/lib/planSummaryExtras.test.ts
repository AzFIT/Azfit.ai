import { describe, it, expect } from "vitest";
import {
  parseInjuries,
  buildWarmupProtocol,
  buildSampleDiet,
  hydrationMl,
  INJURY_KEYWORD_MAP,
  type LibraryExercise,
  type StapleFoodMacros,
} from "./planSummaryExtras";

const LIB: LibraryExercise[] = [
  { id: "1", name: "Walking Lunge", primary_muscle: "Quadriceps", secondary_muscle: null, equipment: "Bodyweight", exercise_type: "Compound" },
  { id: "2", name: "Arm Circles", primary_muscle: "Shoulders", secondary_muscle: null, equipment: "Bodyweight", exercise_type: "Isolation" },
  { id: "3", name: "Cat-Cow", primary_muscle: "Back", secondary_muscle: null, equipment: "Bodyweight", exercise_type: "Isolation" },
  { id: "4", name: "Dead Bug", primary_muscle: "Core", secondary_muscle: null, equipment: "Bodyweight", exercise_type: "Core" },
  { id: "5", name: "Cable Hip Rotation", primary_muscle: "Glutes", secondary_muscle: null, equipment: "Cable", exercise_type: "Isolation" },
  { id: "6", name: "Bear Crawl", primary_muscle: "Full Body", secondary_muscle: null, equipment: "Bodyweight", exercise_type: "Compound" },
];

const FOODS: StapleFoodMacros[] = [
  { name: "Chicken Breast", category: "protein", calories: 120, protein: 22.5, carbs: 0, fats: 2.6 },
  { name: "Whole Eggs", category: "protein", calories: 143, protein: 12.6, carbs: 0.7, fats: 9.5 },
  { name: "Tofu, Firm", category: "protein", calories: 76, protein: 8, carbs: 1.9, fats: 4.2 },
  { name: "White Rice, Cooked", category: "carbs", calories: 130, protein: 2.7, carbs: 28.2, fats: 0.3 },
  { name: "Rolled Oats", category: "carbs", calories: 389, protein: 16.9, carbs: 66, fats: 6.9 },
  { name: "Wholemeal Bread", category: "carbs", calories: 247, protein: 13, carbs: 41, fats: 3.4 },
  { name: "Olive Oil", category: "fats", calories: 884, protein: 0, carbs: 0, fats: 100 },
  { name: "Broccoli", category: "vegetables", calories: 34, protein: 2.8, carbs: 6.6, fats: 0.4 },
  { name: "Greek Yogurt 0%", category: "dairy", calories: 59, protein: 10.3, carbs: 3.6, fats: 0.4 },
];

const TARGETS = { kcal: 1800, proteinG: 135, carbsG: 180, fatsG: 60 };

describe("parseInjuries", () => {
  it("flags the documented muscle groups for recognized keywords", () => {
    const p = parseInjuries("Left knee — avoid deep flexion");
    expect(p.matchedKeywords).toContain("knee");
    expect(p.flaggedMuscles.has("Quadriceps")).toBe(true);
    expect(p.unrecognizedNote).toBeNull();
  });

  it("returns an honest note for unrecognized notes", () => {
    const p = parseInjuries("ouch my elbow");
    expect(p.matchedKeywords).toEqual([]);
    expect(p.unrecognizedNote).toContain("No recognized injury keywords");
  });

  it("empty notes = no flags, no note", () => {
    const p = parseInjuries("");
    expect(p.matchedKeywords).toEqual([]);
    expect(p.unrecognizedNote).toBeNull();
  });
});

describe("buildWarmupProtocol", () => {
  it("excludes knee-dominant (Quadriceps) steps when the notes say knee", () => {
    const r = buildWarmupProtocol("full_gym", "left knee", LIB);
    expect(r.steps.some((s) => s.muscle === "Quadriceps")).toBe(false);
    expect(r.steps.some((s) => s.name === "Walking Lunge")).toBe(false);
    expect(r.note).toContain("knee");
  });

  it("filters by equipment access (bodyweight-only drops cable work)", () => {
    const r = buildWarmupProtocol("bodyweight_only", "", LIB);
    expect(r.steps.every((s) => s.name !== "Cable Hip Rotation")).toBe(true);
    const full = buildWarmupProtocol("full_gym", "", LIB);
    expect(full.steps.some((s) => s.name === "Cable Hip Rotation")).toBe(true);
  });

  it("never pads with fabricated steps — fewer steps + honest note", () => {
    const r = buildWarmupProtocol("bodyweight_only", "knee back shoulder hip ankle wrist neck", LIB);
    expect(r.steps.length).toBeLessThan(4);
    expect(r.note).toContain("honest warm-up step");
  });

  it("is deterministic (same inputs → same steps)", () => {
    const a = buildWarmupProtocol("full_gym", "knee", LIB);
    const b = buildWarmupProtocol("full_gym", "knee", LIB);
    expect(a.steps).toEqual(b.steps);
  });
});

describe("buildSampleDiet", () => {
  const include = FOODS.map((f) => f.name);

  it("returns null when nothing is included (section omitted, no fabrication)", () => {
    expect(buildSampleDiet([], [], null, emptyMeals(), TARGETS, FOODS)).toBeNull();
  });

  it("excluded foods never appear", () => {
    const r = buildSampleDiet(include, ["Chicken Breast"], null, emptyMeals(), TARGETS, FOODS)!;
    const names = r.meals.flatMap((m) => m.items.map((i) => i.food));
    expect(names).not.toContain("Chicken Breast");
  });

  it("restriction WINS: vegan filters eggs/dairy/chicken even when included", () => {
    const r = buildSampleDiet(include, [], "vegan", emptyMeals(), TARGETS, FOODS)!;
    const names = r.meals.flatMap((m) => m.items.map((i) => i.food));
    expect(names).not.toContain("Whole Eggs");
    expect(names).not.toContain("Chicken Breast");
    expect(names).not.toContain("Greek Yogurt 0%");
    expect(names).toContain("Tofu, Firm");
    expect(r.note).toContain("Restriction applied");
  });

  it("gluten_free drops breads but keeps oats/rice", () => {
    const r = buildSampleDiet(include, [], "gluten_free", emptyMeals(), TARGETS, FOODS)!;
    const names = r.meals.flatMap((m) => m.items.map((i) => i.food));
    expect(names).not.toContain("Wholemeal Bread");
    expect(names).toContain("White Rice, Cooked");
  });

  it("honors meal preferences where set", () => {
    const prefs = emptyMeals();
    prefs.breakfast = ["Rolled Oats"];
    const r = buildSampleDiet(include, [], null, prefs, TARGETS, FOODS)!;
    const breakfast = r.meals.find((m) => m.name === "Breakfast")!;
    expect(breakfast.items.some((i) => i.food === "Rolled Oats")).toBe(true);
    expect(r.note).toContain("Meal preferences honored");
  });

  it("totals approach the kcal target (within ±10% after scaling)", () => {
    const r = buildSampleDiet(include, [], null, emptyMeals(), TARGETS, FOODS)!;
    expect(Math.abs(r.totals.kcal - TARGETS.kcal)).toBeLessThanOrEqual(TARGETS.kcal * 0.1);
    expect(r.withinTolerance).toBe(true);
  });

  it("is deterministic", () => {
    const a = buildSampleDiet(include, ["Chicken Breast"], null, emptyMeals(), TARGETS, FOODS);
    const b = buildSampleDiet(include, ["Chicken Breast"], null, emptyMeals(), TARGETS, FOODS);
    expect(a).toEqual(b);
  });
});

describe("hydrationMl", () => {
  it("30–35 ml/kg, rounded to 50 ml", () => {
    expect(hydrationMl(80)).toEqual({ min: 2400, max: 2800 });
    expect(hydrationMl(63)).toEqual({ min: 1900, max: 2200 });
  });
});

describe("INJURY_KEYWORD_MAP", () => {
  it("every rule has muscles + a documented reason", () => {
    for (const rule of Object.values(INJURY_KEYWORD_MAP)) {
      expect(rule.muscles.length).toBeGreaterThan(0);
      expect(rule.why.length).toBeGreaterThan(0);
    }
  });
});

function emptyMeals() {
  return { breakfast: [], lunch: [], dinner: [], snacks: [], refeed: [], cheat_day: [] } as const;
}
