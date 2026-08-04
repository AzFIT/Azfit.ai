import { describe, it, expect } from "vitest";
import { filterFoods, generateMealPlan, rankFoodPool, resolvePlanFood, MEAL_ORDER, MEAL_SPLIT, type FoodInput } from "@/lib/mealPlan";

const food = (
  id: string,
  name: string,
  calories: number,
  protein = 10,
  carbs = 10,
  fats = 5,
  extra: Partial<FoodInput> = {},
): FoodInput => ({
  id,
  name,
  brand: null,
  category: null,
  serving_size_g: 100,
  calories,
  protein,
  carbs,
  fats,
  ...extra,
});

const POOL: FoodInput[] = [
  food("1", "Grilled Chicken Breast", 165, 31, 0, 3.6),
  food("2", "White Rice", 130, 2.7, 28, 0.3),
  food("3", "Greek Yogurt", 97, 9, 3.6, 5),
  food("4", "Oats", 150, 5, 27, 2.5),
  food("5", "Banana", 105, 1.3, 27, 0.4),
  food("6", "Almonds", 164, 6, 6, 14),
  food("7", "Egg", 78, 6.3, 0.6, 5.3),
  food("8", "Salmon Fillet", 208, 20, 0, 13),
  food("9", "Broccoli", 55, 3.7, 11, 0.6),
  food("10", "Cheddar Cheese", 120, 7, 0.4, 10),
];

describe("filterFoods", () => {
  it("drops foods matching restriction terms in name/brand/category (case-insensitive)", () => {
    const out = filterFoods(POOL, ["CHICKEN", "salmon"]);
    expect(out.find((f) => f.name.includes("Chicken"))).toBeUndefined();
    expect(out.find((f) => f.name.includes("Salmon"))).toBeUndefined();
    expect(out.length).toBe(POOL.length - 2);
  });

  it("supports comma-separated restriction strings", () => {
    const out = filterFoods(POOL, ["chicken, salmon, egg"]);
    expect(out.find((f) => ["1", "7", "8"].includes(f.id))).toBeUndefined();
  });

  it("drops brand/category matches too", () => {
    const withBrand = [food("b1", "Protein Bar", 200, 20, 20, 8, { brand: "NutriPeanut" })];
    expect(filterFoods(withBrand, ["peanut"])).toHaveLength(0);
  });

  it("vegetarian drops meat/fish keywords but keeps dairy/eggs", () => {
    const out = filterFoods(POOL, [], "vegetarian");
    expect(out.find((f) => ["1", "8"].includes(f.id))).toBeUndefined(); // chicken + salmon
    expect(out.find((f) => f.id === "3")).toBeDefined(); // yogurt stays
    expect(out.find((f) => f.id === "7")).toBeDefined(); // egg stays
  });

  it("vegan drops meat/fish AND dairy/egg keywords", () => {
    const out = filterFoods(POOL, [], "vegan");
    expect(out.find((f) => ["1", "8", "3", "7", "10"].includes(f.id))).toBeUndefined();
    expect(out.map((f) => f.id).sort()).toEqual(["2", "4", "5", "6", "9"]);
  });
});

describe("generateMealPlan", () => {
  const targets = { calories: 2400, protein: 180, carbs: 240, fats: 80 };

  it("splits calories across meals within ±15% of each slice (when foods allow)", () => {
    const plan = generateMealPlan(POOL, targets, { seed: 7 });
    for (const meal of MEAL_ORDER) {
      const slice = targets.calories * MEAL_SPLIT[meal];
      const actual = plan.byMeal[meal].calories;
      // rounding to 5g can deviate a bit; allow ±25% absolute, or skip tiny pools
      expect(Math.abs(actual - slice) / slice).toBeLessThan(0.25);
    }
  });

  it("is deterministic per seed and shuffles on a different seed", () => {
    const a = generateMealPlan(POOL, targets, { seed: 42 });
    const b = generateMealPlan(POOL, targets, { seed: 42 });
    const c = generateMealPlan(POOL, targets, { seed: 43 });
    expect(a.items.map((i) => i.name)).toEqual(b.items.map((i) => i.name));
    expect(a.items.map((i) => i.name)).not.toEqual(c.items.map((i) => i.name));
  });

  it("respects restrictions end-to-end", () => {
    const plan = generateMealPlan(POOL, targets, { restrictions: ["chicken"], seed: 7 });
    expect(plan.items.find((i) => i.name.toLowerCase().includes("chicken"))).toBeUndefined();
    expect(plan.items.length).toBeGreaterThan(0);
  });

  it("produces vegan plans with no meat/dairy/egg items", () => {
    const plan = generateMealPlan(POOL, targets, { diet: "vegan", seed: 7 });
    const banned = ["chicken", "salmon", "yogurt", "egg", "cheddar"];
    for (const item of plan.items) {
      for (const b of banned) {
        expect(item.name.toLowerCase()).not.toContain(b);
      }
    }
  });

  it("handles empty foods gracefully", () => {
    const plan = generateMealPlan([], targets, { seed: 1 });
    expect(plan.items).toEqual([]);
    expect(plan.totals.calories).toBe(0);
  });

  it("handles everything-filtered-out gracefully", () => {
    const allRestricted = [
      food("x", "Peanut Butter", 200),
      food("y", "Peanut Oil", 240),
      food("z", "Almond Milk", 60, 2, 8, 2.5, { brand: "PeanutCo" }),
    ];
    const plan = generateMealPlan(allRestricted, targets, { restrictions: ["peanut"], seed: 1 });
    expect(plan.items).toEqual([]);
    expect(plan.totals.calories).toBe(0);
  });

  it("servings are rounded to 5g with a 15g floor", () => {
    const plan = generateMealPlan(POOL, targets, { seed: 7 });
    for (const item of plan.items) {
      expect(item.serving_g % 5).toBe(0);
      expect(item.serving_g).toBeGreaterThanOrEqual(15);
    }
  });
});

describe("resolvePlanFood (Phase 38)", () => {
  it("matches a plain name exactly (trimmed, case-insensitive)", () => {
    expect(resolvePlanFood("grilled chicken breast", POOL)?.id).toBe("1");
    expect(resolvePlanFood("  White Rice  ", POOL)?.id).toBe("2");
  });

  it("matches the composite `name (brand)` form", () => {
    const foods = [food("9", "Almond Milk", 60, 2, 8, 2.5, { brand: "PeanutCo" })];
    expect(resolvePlanFood("Almond Milk (PeanutCo)", foods)?.id).toBe("9");
  });

  it("returns null when nothing matches (caller skips, never guesses)", () => {
    expect(resolvePlanFood("Unicorn Steak", POOL)).toBeNull();
    // composite string must NOT match the plain name alone
    const foods = [food("9", "Almond Milk", 60, 2, 8, 2.5, { brand: "PeanutCo" })];
    expect(resolvePlanFood("Almond Milk (OtherBrand)", foods)).toBeNull();
  });
});

describe("rankFoodPool (Phase 39)", () => {
  const staple = (id: string, name: string, kcal: number, p: number, c: number, f: number, category: string) =>
    food(id, name, kcal, p, c, f, { category, source: "seed-staples" });
  const junk = (id: string, name: string, kcal: number, p: number, c: number, f: number) =>
    food(id, name, kcal, p, c, f, { category: "Snacks", source: "off" });

  it("seed-staples rank before non-staple rows regardless of macros", () => {
    const ranked = rankFoodPool(
      [junk("j", "Ice Cream", 207, 3.5, 24, 11), staple("s", "Chicken Breast", 120, 22, 0, 2.5, "protein")],
      "lunch",
    );
    expect(ranked.map((f) => f.id)).toEqual(["s", "j"]);
  });

  it("snack slots prefer fruit/snacks/dairy categories within the staple tier", () => {
    const ranked = rankFoodPool(
      [
        staple("v", "Broccoli", 34, 2.8, 7, 0.4, "vegetables"),
        staple("f", "Banana", 89, 1.1, 23, 0.3, "fruit"),
      ],
      "snacks",
    );
    expect(ranked[0].id).toBe("f");
  });

  it("low_carb ranks low carb-density first; high_carb the reverse", () => {
    const pool = [
      staple("c", "Rice", 130, 2.7, 28, 0.3, "carbs"),
      staple("p", "Chicken Breast", 120, 22, 0, 2.5, "protein"),
    ];
    expect(rankFoodPool(pool, "lunch", "low_carb")[0].id).toBe("p");
    expect(rankFoodPool(pool, "lunch", "high_carb")[0].id).toBe("c");
  });

  it("high_protein / balanced rank protein-density first", () => {
    const pool = [
      staple("c", "Oats", 150, 5, 27, 2.5, "carbs"),
      staple("p", "Egg Whites", 52, 11, 0.7, 0.2, "protein"),
    ];
    expect(rankFoodPool(pool, "lunch", "high_protein")[0].id).toBe("p");
    expect(rankFoodPool(pool, "lunch")[0].id).toBe("p");
  });

  it("generateMealPlan keeps junk out when staples fill the pool", () => {
    const staples = Array.from({ length: 12 }, (_, i) =>
      staple(`s${i}`, `Staple ${i}`, 120 + i * 10, 20 - i, 5 + i * 2, 3, i % 2 ? "protein" : "carbs"),
    );
    const junkFoods = Array.from({ length: 8 }, (_, i) =>
      junk(`j${i}`, `Ice Cream ${i}`, 250, 3, 30, 12),
    );
    const plan = generateMealPlan([...junkFoods, ...staples], { calories: 2400, protein: 150, carbs: 240, fats: 80 }, { seed: 3 });
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.items.every((it) => it.name.startsWith("Staple"))).toBe(true);
  });
});
