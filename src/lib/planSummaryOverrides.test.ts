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
  effectiveAssessment,
  effectiveCalories,
  effectiveMacros,
  effectiveTraining,
  effectiveCoachNotes,
  coachNotesParagraphs,
  effectiveHeader,
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

/* ── Phase 99g — core-card effective helpers ─────────────────── */
function coreResult(): BlueprintResult {
  return {
    header: { generatedIso: "2026-03-01T10:00:00", trainerName: "Coach", businessName: "AzFIT Studio" },
    assessment: {
      weightKg: 90, heightCm: 170, bmi: 31.1, bodyFatPct: 28, fatMassKg: 25.2, leanMassKg: 64.8,
      bmr: 1650, bmrMethod: "mifflin-st-jeor", maintenance: 2200,
    },
    goal: { statement: "Lose 10 kg", isFatLoss: true, programWeeks: 12 },
    calories: { target: 1700, maintenance: 2200, deficitPct: 0.2273, clampedByFloor: false },
    macroStyles: [
      {
        key: "balanced", name: "Balanced", bestFor: "most people",
        atTarget: { proteinG: 150, carbsG: 170, fatsG: 60, belowFloor: false },
        atMaintenance: { proteinG: 150, carbsG: 250, fatsG: 80, belowFloor: false },
      },
      {
        key: "low-carb", name: "Low Carb", bestFor: "satiety",
        atTarget: { proteinG: 120, carbsG: 100, fatsG: 78, belowFloor: false },
        atMaintenance: { proteinG: 120, carbsG: 150, fatsG: 90, belowFloor: false },
      },
    ],
    recommended: { key: "balanced", name: "Balanced", reason: "sustainable" },
    proteinFloor: { grams: 130, basis: "2.0 g/kg target weight" },
    training: {
      sessions: [
        { name: "Day A", kind: "trainer", blocks: [{ label: "A1", exercises: "Goblet Squat", setsReps: "4×10", tempo: "4010", rest: "60s" }], rounds: null, finisher: null },
      ],
      restRules: ["rest 60s between supersets"],
      stepTarget: 8000,
    },
    trainingMeta: { notes: ["method: GBC"] },
  } as unknown as BlueprintResult;
}

describe("Phase 99g — effectiveAssessment", () => {
  it("base passes through unchanged", () => {
    const r = coreResult();
    expect(effectiveAssessment(r)).toEqual({ ...r.assessment, goalStatement: "Lose 10 kg" });
  });

  it("edited weight/height recompute BMI + fat/lean mass (never stale derived numbers)", () => {
    const r = coreResult();
    r.overrides = { assessment: { weightKg: 100, heightCm: 180, bodyFatPct: 25 } };
    const a = effectiveAssessment(r);
    expect(a.bmi).toBeCloseTo(100 / 1.8 ** 2, 1);
    expect(a.leanMassKg).toBeCloseTo(75, 1);
    expect(a.fatMassKg).toBeCloseTo(25, 1);
    // engine numbers stay base — they belong to the calorie engine
    expect(a.bmr).toBe(1650);
    expect(a.maintenance).toBe(2200);
    expect(a.goalStatement).toBe("Lose 10 kg");
  });

  it("goalStatement override wins; bodyFatPct null clears derived mass", () => {
    const r = coreResult();
    r.overrides = { assessment: { goalStatement: "Recomp — keep the number, change the shape" } };
    expect(effectiveAssessment(r).goalStatement).toBe("Recomp — keep the number, change the shape");
    r.overrides = { assessment: { bodyFatPct: null } };
    const a = effectiveAssessment(r);
    expect(a.bodyFatPct).toBeNull();
    expect(a.fatMassKg).toBeNull();
    expect(a.leanMassKg).toBeNull();
  });
});

describe("Phase 99g — effectiveCalories", () => {
  it("target edit recomputes the deficit pair and drops the floor note", () => {
    const r = coreResult();
    r.calories.clampedByFloor = true; // engine-raised base
    r.overrides = { calories: { target: 2000 } };
    const c = effectiveCalories(r);
    expect(c.target).toBe(2000);
    expect(c.deficitPct).toBeCloseTo((2200 - 2000) / 2200, 4);
    expect(c.deficitPerDay).toBe(200);
    expect(c.clampedByFloor).toBe(false); // deliberate manual target
    expect(c.overridden).toBe(true);
    // base untouched
    expect(r.calories.target).toBe(1700);
  });

  it("explicit deficitPct applies directly; no override = base passthrough", () => {
    const r = coreResult();
    r.overrides = { calories: { deficitPct: 0.15 } };
    expect(effectiveCalories(r).deficitPct).toBe(0.15);
    delete r.overrides;
    const c = effectiveCalories(r);
    expect(c.target).toBe(1700);
    expect(c.overridden).toBe(false);
  });
});

describe("Phase 99g — effectiveMacros", () => {
  it("edited grams merge per style; below-floor flag + note recompute", () => {
    const r = coreResult();
    r.overrides = { macros: { styles: { "low-carb": { proteinG: 100, carbsG: 120, fatsG: 80 } } } };
    const m = effectiveMacros(r);
    const low = m.styles.find((s) => s.key === "low-carb")!;
    expect(low.atTarget).toEqual({ proteinG: 100, carbsG: 120, fatsG: 80, belowFloor: true, note: "Below your protein floor — boost protein by trimming carbs" });
    expect(m.anyBelowFloor).toBe(true);
    // untouched style keeps its base numbers
    const bal = m.styles.find((s) => s.key === "balanced")!;
    expect(bal.atTarget.proteinG).toBe(150);
    expect(bal.atTarget.belowFloor).toBe(false);
  });

  it("recommendedKey switch resolves to the style with the coach-pick reason", () => {
    const r = coreResult();
    r.overrides = { macros: { recommendedKey: "low-carb" } };
    const m = effectiveMacros(r);
    expect(m.recommended).toEqual({ key: "low-carb", name: "Low Carb", reason: "your coach's pick for this plan" });
    // unknown key falls back to the base pick
    r.overrides = { macros: { recommendedKey: "nope" } };
    expect(effectiveMacros(r).recommended.key).toBe("balanced");
  });
});

describe("Phase 99g — effectiveTraining", () => {
  it("restRules / stepTarget / session blocks merge over the base", () => {
    const r = coreResult();
    r.overrides = {
      training: {
        stepTarget: 10000,
        restRules: ["rest 90s"],
        sessions: [{ name: "Day A", kind: "trainer", blocks: [{ label: "A1", exercises: "Trap Bar Deadlift", setsReps: "3×8", tempo: "3010", rest: "90s" }], rounds: null, finisher: null }],
      },
    };
    const t = effectiveTraining(r);
    expect(t.stepTarget).toBe(10000);
    expect(t.restRules).toEqual(["rest 90s"]);
    expect(t.sessions[0].blocks[0].exercises).toBe("Trap Bar Deadlift");
    expect(t.metaNotes).toEqual(["method: GBC"]);
    // base untouched
    expect(r.training.stepTarget).toBe(8000);
  });

  it("no override = base passthrough", () => {
    const t = effectiveTraining(coreResult());
    expect(t.sessions).toHaveLength(1);
    expect(t.stepTarget).toBe(8000);
  });
});

describe("Phase 99g — Coach's Notes + header override", () => {
  it("effectiveCoachNotes: blank/whitespace → null (no card), text → text", () => {
    const r = coreResult();
    expect(effectiveCoachNotes(r)).toBeNull();
    r.coachNotes = "   ";
    expect(effectiveCoachNotes(r)).toBeNull();
    r.coachNotes = "Great first week!";
    expect(effectiveCoachNotes(r)).toBe("Great first week!");
  });

  it("coachNotesParagraphs splits on blank lines, trims, drops empties", () => {
    expect(coachNotesParagraphs("One.\n\nTwo.\n\n\nThree with\na line break.")).toEqual([
      "One.",
      "Two.",
      "Three with\na line break.",
    ]);
  });

  it("effectiveHeader: override wins, blank trainer falls back, null business hides", () => {
    const r = coreResult();
    expect(effectiveHeader(r)).toEqual({ trainerName: "Coach", businessName: "AzFIT Studio" });
    r.headerOverride = { trainerName: "Alex", businessName: null };
    expect(effectiveHeader(r)).toEqual({ trainerName: "Alex", businessName: null });
    r.headerOverride = { trainerName: "  " };
    expect(effectiveHeader(r).trainerName).toBe("Coach");
    r.headerOverride = { businessName: "New Studio" };
    expect(effectiveHeader(r)).toEqual({ trainerName: "Coach", businessName: "New Studio" });
  });

  it("sectionNumber: coachNotes takes the last slot only when text exists", () => {
    const r = coreResult();
    r.weeklyTargets = undefined as unknown as BlueprintResult["weeklyTargets"];
    r.cardio = undefined as unknown as BlueprintResult["cardio"];
    r.nutritionGuide = undefined as unknown as BlueprintResult["nutritionGuide"];
    expect(sectionNumber(r, "faq")).toBe(8);
    r.coachNotes = "notes";
    expect(sectionNumber(r, "coachNotes")).toBe(9);
    expect(presentSectionKeys(r)).toContain("coachNotes");
    expect(includedCount(r)).toBe(presentSectionKeys(r).length);
    // tick-excluded coachNotes → 0
    r.included = { coachNotes: false };
    expect(sectionNumber(r, "coachNotes")).toBe(0);
    expect(isIncluded(r.included, "coachNotes")).toBe(false);
  });
});
