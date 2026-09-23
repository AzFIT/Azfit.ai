/* Phase 99d Items 1+2 — planSummaryOverrides unit tests. */
import { describe, expect, it } from "vitest";
import {
  mergeDefined,
  effectiveWelcome,
  effectiveWeeklyTargets,
  effectiveCardio,
  effectiveNutritionGuide,
  effectiveSampleDay,
  effectiveTracking,
  effectiveFaq,
  effectiveRoadmap,
  isIncluded,
  presentSectionKeys,
  includedCount,
  sectionNumber,
  type PlanOverrides,
} from "./planSummaryOverrides";
import type { BlueprintResult } from "./planBlueprint";

function baseResult(): BlueprintResult {
  return {
    calories: { target: 1700, maintenance: 2200 } as BlueprintResult["calories"],
    welcome: { title: "Welcome aboard, Sam!", message: "Generated message." },
    weeklyTargets: {
      baseline: { recordedAt: "2026-01-05", weightKg: 90, bodyFatPct: 28 },
      goal: { label: "fat loss", targetWeightKg: 80, targetBodyFatPct: null, targetDate: null },
      weeklyRate: { minKg: 0.5, maxKg: 0.9, label: "0.5–0.9 kg/week" },
      expectations: [{ weeks: "Weeks 1–2", focus: "Settle in", expectation: "learn the routine" }],
      nonScaleVictories: ["sleep improves"],
      goalDateHonestNote: null,
      realisticWeeksEstimate: 12,
      notes: [],
    },
    cardio: { rows: [{ machine: "Exercise bike", protocol: "LISS", difficulty: "Beginner", intensity: "RPE 4–5", basis: "20 min", schedule: "2×/week", progression: [] }], weeklyMinutes: 40, stepNote: "steps", notes: [] },
    nutritionGuide: { title: "Eating well", intro: "intro", blocks: [{ heading: "Protein", points: ["eat it"] }], safetyCallout: null, whoShouldNotCut: ["pregnant"], notes: [] },
    sampleDay: { meals: [{ name: "Breakfast", items: ["eggs"], macros: { kcal: 400, p: 30, c: 20, f: 20 } }], totals: { kcal: 400, p: 30, c: 20, f: 20 }, withinTolerance: true },
    tracking: [{ what: "Weight", frequency: "Daily", note: "morning" }],
    faq: [{ q: "Q?", a: "A." }],
    roadmap: [{ weeks: "1-4", name: "Base", kcal: "", note: "n" }] as unknown as BlueprintResult["roadmap"],
  } as unknown as BlueprintResult;
}

describe("mergeDefined", () => {
  it("applies defined fields only; keeps null as a deliberate clear", () => {
    expect(mergeDefined({ a: 1, b: 2 }, { b: undefined, a: null } as never)).toEqual({ a: null, b: 2 });
    expect(mergeDefined({ a: 1 }, undefined)).toEqual({ a: 1 });
  });
});

describe("effective* helpers", () => {
  it("welcome override wins, base preserved without override", () => {
    const r = baseResult();
    expect(effectiveWelcome(r)).toEqual(r.welcome);
    r.overrides = { welcome: { message: "Edited." } } as PlanOverrides;
    expect(effectiveWelcome(r)).toEqual({ title: "Welcome aboard, Sam!", message: "Edited." });
  });

  it("weekly targets: nested merge + array replacement", () => {
    const r = baseResult();
    r.overrides = {
      weeklyTargets: { baseline: { weightKg: 88 }, expectations: [{ weeks: "W1", focus: "f", expectation: "e" }] },
    };
    const eff = effectiveWeeklyTargets(r)!;
    expect(eff.baseline.weightKg).toBe(88);
    expect(eff.baseline.bodyFatPct).toBe(28); // base preserved
    expect(eff.goal.targetWeightKg).toBe(80);
    expect(eff.expectations).toHaveLength(1);
    expect(eff.nonScaleVictories).toEqual(["sleep improves"]);
  });

  it("cardio rows replace wholesale", () => {
    const r = baseResult();
    r.overrides = { cardio: { rows: [] } };
    expect(effectiveCardio(r)!.rows).toHaveLength(0);
    delete r.overrides;
    expect(effectiveCardio(r)!.rows).toHaveLength(1);
  });

  it("sample day totals recompute from edited meals — never stale", () => {
    const r = baseResult();
    r.overrides = { sampleDay: { meals: [
      { name: "Breakfast", items: ["eggs"], macros: { kcal: 500, p: 40, c: 30, f: 22 } },
      { name: "Lunch", items: ["chicken"], macros: { kcal: 700, p: 50, c: 40, f: 25 } },
    ] } };
    const eff = effectiveSampleDay(r);
    expect(eff.totals).toEqual({ kcal: 1200, p: 90, c: 70, f: 47 });
  });

  it("tracking/faq/roadmap/nutritionGuide fall back to base without overrides", () => {
    const r = baseResult();
    expect(effectiveTracking(r)).toBe(r.tracking);
    expect(effectiveFaq(r)).toBe(r.faq);
    expect(effectiveRoadmap(r)).toBe(r.roadmap);
    expect(effectiveNutritionGuide(r)).toBe(r.nutritionGuide);
  });
});

describe("include ticks", () => {
  it("absent = included; explicit false excluded", () => {
    expect(isIncluded(undefined, "faq")).toBe(true);
    expect(isIncluded({ faq: false }, "faq")).toBe(false);
    expect(isIncluded({ faq: true }, "faq")).toBe(true);
  });

  it("counts only present sections", () => {
    const r = baseResult();
    const total = presentSectionKeys(r).length;
    expect(includedCount(r)).toBe(total);
    r.included = { faq: false, cardio: false };
    expect(includedCount(r)).toBe(total - 2);
    // excluded welcome still counted when present
    r.included = { welcome: false };
    expect(includedCount(r)).toBe(total - 1);
  });
});

describe("sectionNumber", () => {
  it("numbers sections in report order, welcome unnumbered", () => {
    const r = baseResult();
    expect(sectionNumber(r, "assessment")).toBe(1);
    expect(sectionNumber(r, "calories")).toBe(2);
    expect(sectionNumber(r, "macros")).toBe(3);
    expect(sectionNumber(r, "weeklyTargets")).toBe(4);
    expect(sectionNumber(r, "training")).toBe(5);
    expect(sectionNumber(r, "cardio")).toBe(6);
    expect(sectionNumber(r, "faq")).toBe(11);
  });

  it("returns 0 for absent sections and renumbers after exclusions", () => {
    const r = baseResult();
    expect(sectionNumber(r, "warmup")).toBe(0); // no extras
    r.included = { calories: false, macros: false };
    expect(sectionNumber(r, "training")).toBe(3); // 1 assessment, 2 weeklyTargets, 3 training
    expect(sectionNumber(r, "calories")).toBe(0);
  });

  it("female reassurance takes a number only when present", () => {
    const r = baseResult();
    expect(sectionNumber(r, "femaleNote")).toBe(0);
    r.femaleReassurance = true;
    expect(sectionNumber(r, "assessment")).toBe(1);
    expect(sectionNumber(r, "femaleNote")).toBe(2);
    expect(sectionNumber(r, "calories")).toBe(3);
  });
});
