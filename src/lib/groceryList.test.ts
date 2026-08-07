import { describe, it, expect } from "vitest";
import {
  buildGroceryList,
  applyMultiplier,
  formatQuantity,
  sinkChecked,
  mergeCheckedState,
  orderGroceryList,
} from "@/lib/groceryList";
import type { FoodInput } from "@/lib/mealPlan";

const food = (id: string, name: string, category: string): FoodInput => ({
  id,
  name,
  brand: null,
  category,
  serving_size_g: 100,
  calories: 100,
  protein: 10,
  carbs: 10,
  fats: 5,
  source: "seed-staples",
});

const FOODS = [
  food("f-chicken", "Chicken Breast", "protein"),
  food("f-rice", "White Rice, Cooked", "carbs"),
  food("f-bar", "Protein Bar (60g bar)", "snacks"),
  food("f-broc", "Broccoli", "vegetables"),
];

const item = (name: string, grams: number, day = 1) => ({
  name,
  serving_g: grams,
  day,
  calories: 100,
  protein: 10,
  carbs: 10,
  fats: 5,
});

describe("buildGroceryList (Phase 51)", () => {
  it("aggregates the same food across days", () => {
    const list = buildGroceryList(
      [item("Chicken Breast", 150, 1), item("Chicken Breast", 200, 2), item("White Rice, Cooked", 250, 1)],
      FOODS,
    );
    const chicken = list.find((i) => i.key === "f-chicken")!;
    expect(chicken.grams).toBe(350);
    expect(chicken.matched).toBe(true);
  });

  it("day-range filter includes only the selected days", () => {
    const list = buildGroceryList(
      [item("Chicken Breast", 100, 1), item("Chicken Breast", 100, 3)],
      FOODS,
      [1],
    );
    expect(list.find((i) => i.key === "f-chicken")!.grams).toBe(100);
  });

  it("unmatched names land in the unmatched bucket keyed by name", () => {
    const list = buildGroceryList([item("Unicorn Steak", 100)], FOODS);
    expect(list[0].category).toBe("unmatched");
    expect(list[0].key).toBe("name:unicorn steak");
    expect(list[0].matched).toBe(false);
  });

  it("snacks category folds into 'other'", () => {
    const list = buildGroceryList([item("Protein Bar (60g bar)", 60)], FOODS);
    expect(list[0].category).toBe("other");
  });

  it("fixed category order: protein → carbs → vegetables → … → unmatched", () => {
    const list = buildGroceryList(
      [
        item("Broccoli", 100),
        item("Unicorn Steak", 50),
        item("White Rice, Cooked", 100),
        item("Chicken Breast", 100),
      ],
      FOODS,
    );
    expect(list.map((i) => i.category)).toEqual(["protein", "carbs", "vegetables", "unmatched"]);
  });
});

describe("applyMultiplier (Phase 51)", () => {
  it("×2 doubles, ×1 returns the SAME list reference, never mutates", () => {
    const base = buildGroceryList([item("Chicken Breast", 150)], FOODS);
    const doubled = applyMultiplier(base, 2);
    expect(doubled[0].grams).toBe(300);
    expect(base[0].grams).toBe(150); // base untouched
    expect(applyMultiplier(base, 1)).toBe(base);
  });
});

describe("formatQuantity (Phase 51)", () => {
  it("nearest 5g under 1000, kg at ≥1000", () => {
    expect(formatQuantity(152)).toBe("150 g");
    expect(formatQuantity(998)).toBe("1000 g".replace("1000 g", "1 kg"));
    expect(formatQuantity(1250)).toBe("1.25 kg");
  });
});

describe("checked state helpers (Phase 51)", () => {
  it("sinkChecked sinks checked items within their order, stable", () => {
    const items = orderGroceryList([
      { key: "a", name: "A", category: "protein", grams: 1, kcal: 0, protein: 0, carbs: 0, fats: 0, matched: true },
      { key: "b", name: "B", category: "protein", grams: 1, kcal: 0, protein: 0, carbs: 0, fats: 0, matched: true },
    ]);
    const out = sinkChecked(items, new Set(["a"]));
    expect(out.map((i) => i.key)).toEqual(["b", "a"]);
  });

  it("mergeCheckedState toggles uniquely", () => {
    expect(mergeCheckedState([], "a", true)).toEqual(["a"]);
    expect(mergeCheckedState(["a"], "a", true)).toEqual(["a"]);
    expect(mergeCheckedState(["a", "b"], "a", false)).toEqual(["b"]);
  });
});
