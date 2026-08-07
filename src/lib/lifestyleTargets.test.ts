import { describe, it, expect } from "vitest";
import {
  parseLifestyleTargets,
  mergeLifestyleTargets,
  lifestyleChips,
  hasLifestyleTargets,
  compliancePct,
} from "./lifestyleTargets";

describe("parseLifestyleTargets", () => {
  it("parses a full row", () => {
    expect(parseLifestyleTargets({ steps: 8000, sleep_hours: 7.5, water_ml: 2500 })).toEqual({
      steps: 8000,
      sleep_hours: 7.5,
      water_ml: 2500,
    });
  });
  it("drops junk keys, junk values, and non-objects", () => {
    expect(parseLifestyleTargets({ steps: "lots", water_ml: -5, other: 1 })).toEqual({});
    expect(parseLifestyleTargets(null)).toEqual({});
    expect(parseLifestyleTargets("junk")).toEqual({});
    expect(parseLifestyleTargets(undefined)).toEqual({});
  });
  it("enforces sane ranges", () => {
    expect(parseLifestyleTargets({ steps: 500000, sleep_hours: 30, water_ml: 2500 })).toEqual({ water_ml: 2500 });
  });
  it("accepts numeric strings", () => {
    expect(parseLifestyleTargets({ steps: "9000" })).toEqual({ steps: 9000 });
  });
});

describe("mergeLifestyleTargets", () => {
  it("sets new keys and keeps existing ones", () => {
    expect(mergeLifestyleTargets({ steps: 8000 }, { water_ml: 3000 })).toEqual({ steps: 8000, water_ml: 3000 });
  });
  it("null/empty patch values REMOVE the key (empty input = no target)", () => {
    expect(mergeLifestyleTargets({ steps: 8000, water_ml: 2500 }, { steps: null })).toEqual({ water_ml: 2500 });
    expect(mergeLifestyleTargets({ steps: 8000 }, { steps: 0 })).toEqual({});
  });
  it("overwrites existing keys", () => {
    expect(mergeLifestyleTargets({ steps: 8000 }, { steps: 9000 })).toEqual({ steps: 9000 });
  });
});

describe("lifestyleChips + hasLifestyleTargets", () => {
  it("formats chips in fixed order", () => {
    expect(lifestyleChips({ steps: 9000, sleep_hours: 8, water_ml: 3000 })).toEqual([
      "9,000 steps",
      "8h sleep",
      "3,000 ml water",
    ]);
  });
  it("half-hour sleep keeps one decimal", () => {
    expect(lifestyleChips({ sleep_hours: 7.5 })).toEqual(["7.5h sleep"]);
  });
  it("empty → no chips + hasLifestyleTargets false", () => {
    expect(lifestyleChips({})).toEqual([]);
    expect(hasLifestyleTargets({})).toBe(false);
    expect(hasLifestyleTargets({ steps: 1 })).toBe(true);
  });
});

describe("compliancePct (ring math)", () => {
  it("completed/planned as a clamped percent", () => {
    expect(compliancePct(2, 4)).toBe(50);
    expect(compliancePct(4, 4)).toBe(100);
  });
  it("extra sessions cap at 100", () => {
    expect(compliancePct(6, 4)).toBe(100);
  });
  it("planned 0 → null (no basis); completed 0 → 0", () => {
    expect(compliancePct(2, 0)).toBeNull();
    expect(compliancePct(0, 3)).toBe(0);
  });
});
