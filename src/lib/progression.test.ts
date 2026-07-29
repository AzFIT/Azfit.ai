import { describe, it, expect } from "vitest";
import { PROGRESSION_PRESETS, progressionNoteForWeek, type ProgressionRule } from "@/lib/progression";

const pick = (id: string): ProgressionRule => PROGRESSION_PRESETS.find((p) => p.id === id)!;

describe("PROGRESSION_PRESETS (Phase 30D)", () => {
  it("has the five doc presets", () => {
    expect(PROGRESSION_PRESETS.map((p) => p.id)).toEqual(["double", "linear", "deload", "rest-pause", "none"]);
  });
});

describe("progressionNoteForWeek", () => {
  const double = pick("double");
  const deload = pick("deload");

  it("week 4 shows the deload text when the deload rule is active", () => {
    expect(progressionNoteForWeek(4, [double, deload])).toBe(deload.text);
    expect(progressionNoteForWeek(8, [double, deload])).toBe(deload.text);
  });

  it("non-deload weeks show the load-progression text", () => {
    expect(progressionNoteForWeek(1, [double, deload])).toBe(double.text);
    expect(progressionNoteForWeek(3, [double, deload])).toBe(double.text);
    expect(progressionNoteForWeek(5, [double, deload])).toBe(double.text);
  });

  it("no deload rule -> week 4 shows the load text like any week", () => {
    expect(progressionNoteForWeek(4, [double])).toBe(double.text);
  });

  it("empty rules -> null; only 'none' rule -> its text", () => {
    expect(progressionNoteForWeek(1, [])).toBeNull();
    expect(progressionNoteForWeek(2, [pick("none")])).toBe(pick("none").text);
  });
});
