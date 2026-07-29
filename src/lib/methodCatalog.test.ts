import { describe, it, expect } from "vitest";
import {
  rankMethods,
  groupByCategory,
  resolveMethodName,
  WIZARD_GOAL_TO_DB,
  type DbMethod,
  type DbMethodCategory,
} from "@/lib/methodCatalog";

const m = (id: string, name: string, slug = name.toLowerCase().replace(/\s+/g, "-"), category_id = 1): DbMethod => ({
  id,
  name,
  slug,
  category: "Classic Strength Protocols",
  category_id,
  description: null,
  tags: "#strength",
  display_order: 0,
});

const cats: DbMethodCategory[] = [
  { id: 2, name: "Conditioning & Intervals", display_order: 2 },
  { id: 1, name: "Classic Strength Protocols", display_order: 1 },
];

describe("WIZARD_GOAL_TO_DB", () => {
  it("maps all six wizard goals (power intentionally unranked)", () => {
    expect(WIZARD_GOAL_TO_DB.hypertrophy).toEqual(["Hypertrophy", "Build Muscle"]);
    expect(WIZARD_GOAL_TO_DB.fatloss).toEqual(["Fat Loss", "Lose Weight"]);
    expect(WIZARD_GOAL_TO_DB.strength).toEqual(["Strength"]);
    expect(WIZARD_GOAL_TO_DB.endurance).toEqual(["Endurance", "Conditioning"]);
    expect(WIZARD_GOAL_TO_DB.power).toEqual([]);
    expect(WIZARD_GOAL_TO_DB.rehab).toEqual(["Injury Rehab", "Prehab / Rehab"]);
  });
});

describe("rankMethods", () => {
  const methods = [m("a", "Beta Method"), m("b", "Alpha Method"), m("c", "Gamma Method")];

  it("sorts scored desc, unscored after alphabetically", () => {
    const ranked = rankMethods(methods, [
      { method_id: "b", score: 40 },
      { method_id: "c", score: 55 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(ranked[2].score).toBeNull();
  });

  it("takes the best score across multiple mapped goals", () => {
    const ranked = rankMethods(methods, [
      { method_id: "a", score: 30 },
      { method_id: "a", score: 48 },
    ]);
    expect(ranked[0].id).toBe("a");
    expect(ranked[0].score).toBe(48);
  });

  it("empty scores -> pure alphabetical, all null", () => {
    const ranked = rankMethods(methods, []);
    expect(ranked.map((r) => r.name)).toEqual(["Alpha Method", "Beta Method", "Gamma Method"]);
    expect(ranked.every((r) => r.score === null)).toBe(true);
  });
});

describe("groupByCategory", () => {
  it("groups under categories ordered by display_order; uncategorized last as Other", () => {
    const ranked = rankMethods(
      [m("a", "A", "a", 2), m("b", "B", "b", 1), m("c", "C", "c", null)],
      []
    );
    const groups = groupByCategory(ranked, cats);
    expect(groups.map((g) => g.category)).toEqual([
      "Classic Strength Protocols",
      "Conditioning & Intervals",
      "Other",
    ]);
    expect(groups[0].methods[0].name).toBe("B");
    expect(groups[2].methods[0].name).toBe("C");
  });

  it("drops empty categories", () => {
    const groups = groupByCategory(rankMethods([m("a", "A", "a", 1)], []), cats);
    expect(groups.map((g) => g.category)).toEqual(["Classic Strength Protocols"]);
  });
});

describe("resolveMethodName", () => {
  const db = [m("x", "German Volume Training (10x10)", "german-volume-training-10x10")];

  it("DB slug -> live name", () => {
    expect(resolveMethodName("german-volume-training-10x10", db)).toBe("German Volume Training (10x10)");
  });

  it("legacy id -> legacy label", () => {
    expect(resolveMethodName("german-volume", [])).toBe("German Volume Training");
    expect(resolveMethodName("5x5", [])).toBe("5x5 Stronglifts");
  });

  it("unknown -> humanized raw value; empty -> dash", () => {
    expect(resolveMethodName("wave-loading", [])).toBe("Wave Loading");
    expect(resolveMethodName("", [])).toBe("—");
  });
});
