import { describe, it, expect } from "vitest";
import { nutritionDot, sortNutritionRows } from "@/lib/nutritionCommand";

describe("nutritionDot (Phase 37)", () => {
  it("red when no targets, regardless of plan", () => {
    expect(nutritionDot({ hasTargets: false, hasPlan: false })).toBe("red");
    expect(nutritionDot({ hasTargets: false, hasPlan: true })).toBe("red");
  });

  it("amber when targets exist but no plan", () => {
    expect(nutritionDot({ hasTargets: true, hasPlan: false })).toBe("amber");
  });

  it("green when targets and plan both exist", () => {
    expect(nutritionDot({ hasTargets: true, hasPlan: true })).toBe("green");
  });
});

describe("sortNutritionRows (Phase 37)", () => {
  it("orders red → amber → green, alphabetical within a group", () => {
    const rows = [
      { name: "Zoe", hasTargets: false, hasPlan: false },
      { name: "Amy", hasTargets: true, hasPlan: true },
      { name: "Bob", hasTargets: true, hasPlan: false },
      { name: "Ann", hasTargets: false, hasPlan: false },
      { name: "Cal", hasTargets: true, hasPlan: false },
    ];
    expect(sortNutritionRows(rows).map((r) => r.name)).toEqual([
      "Ann", // red, alphabetical
      "Zoe", // red
      "Bob", // amber, alphabetical
      "Cal", // amber
      "Amy", // green last despite name
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      { name: "B", hasTargets: true, hasPlan: true },
      { name: "A", hasTargets: false, hasPlan: false },
    ];
    const snapshot = [...rows];
    sortNutritionRows(rows);
    expect(rows).toEqual(snapshot);
  });

  it("empty input → empty output", () => {
    expect(sortNutritionRows([])).toEqual([]);
  });
});
