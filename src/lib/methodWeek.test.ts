import { describe, it, expect } from "vitest";
import { exampleWeekForMethod } from "./methodWeek";
import type { MethodDefaults } from "./methodDefaults";

const base: MethodDefaults = {
  goalTag: "Hypertrophy / volume",
  intensityColor: "green",
  setsReps: "10×10",
  loadPct: "60% 1RM",
  rest: "60–90s",
  tempo: "4-0-1-0",
  notation: "straight",
  notes: "",
  durationWeeks: 4,
  frequencyPerWeek: 4,
  idealFor: [],
  contraindications: [],
  periodizationPairings: [],
  preferredCategories: ["pressing", "pulling", "bilateral_quad", "posterior"],
};

describe("exampleWeekForMethod (Item 5 — drafted from real defaults)", () => {
  it("spreads 4 sessions across the week and rotates preferred categories", () => {
    const week = exampleWeekForMethod(base);
    expect(week.map((s) => s.day)).toEqual(["Mon", "Tue", "Thu", "Sat"]);
    expect(week.map((s) => s.label)).toEqual([
      "Pressing session",
      "Pulling session",
      "Bilateral Quad session",
      "Posterior session",
    ]);
    expect(week[0].detail).toBe("10×10 · rest 60–90s");
  });

  it("3×/week maps to Mon/Wed/Fri; superset notation rides in the detail", () => {
    const week = exampleWeekForMethod({ ...base, frequencyPerWeek: 3, notation: "superset" });
    expect(week.map((s) => s.day)).toEqual(["Mon", "Wed", "Fri"]);
    expect(week[0].detail).toContain("superset");
  });

  it("clamps out-of-range frequencies and survives empty preferredCategories", () => {
    expect(exampleWeekForMethod({ ...base, frequencyPerWeek: 9 }).map((s) => s.day)).toHaveLength(6);
    expect(exampleWeekForMethod({ ...base, frequencyPerWeek: 1 }).map((s) => s.day)).toHaveLength(2);
    const week = exampleWeekForMethod({ ...base, preferredCategories: [] });
    expect(week.every((s) => s.label === "Full Body session")).toBe(true);
  });
});
