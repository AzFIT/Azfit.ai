/* Phase 99g — planSummaryCardDrafts unit tests: draft building,
   override round-trips, save-time validation, header override. */
import { describe, expect, it } from "vitest";
import {
  buildDraft,
  overrideFromDraft,
  validateCardDraft,
  headerOverrideFromDraft,
  type WelcomeDraft,
  type AssessmentDraft,
  type CaloriesDraft,
  type MacrosDraft,
  type TrainingDraft,
  type CoachNotesDraft,
} from "./planSummaryCardDrafts";
import type { BlueprintResult } from "./planBlueprint";

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
    welcome: { title: "Welcome aboard, Sam!", message: "Generated message." },
    coachNotes: null,
  } as unknown as BlueprintResult;
}

describe("buildDraft + overrideFromDraft round-trips (99g cards)", () => {
  it("assessment: build from effective, convert back to the override shape", () => {
    const r = coreResult();
    r.overrides = { assessment: { weightKg: 95 } };
    const draft = buildDraft("assessment", r) as AssessmentDraft;
    expect(draft.weightKg).toBe(95); // effective (override-merged)
    const ov = overrideFromDraft("assessment", draft);
    expect(ov).toEqual({ weightKg: 95, heightCm: 170, bodyFatPct: 28, goalStatement: "Lose 10 kg" });
  });

  it("calories: whole-percent draft ↔ fraction override", () => {
    const r = coreResult();
    const draft = buildDraft("calories", r) as CaloriesDraft;
    expect(draft.target).toBe(1700);
    expect(draft.deficitPct).toBeCloseTo(22.7, 1);
    draft.target = 1900;
    const ov = overrideFromDraft("calories", draft);
    expect(ov?.target).toBe(1900);
    expect(ov?.deficitPct).toBeCloseTo(0.227, 3); // fraction, not whole percent
  });

  it("macros: styles carry grams; recommendedKey round-trips", () => {
    const r = coreResult();
    const draft = buildDraft("macros", r) as MacrosDraft;
    expect(draft.styles).toHaveLength(2);
    expect(draft.recommendedKey).toBe("balanced");
    draft.recommendedKey = "low-carb";
    draft.styles[1].proteinG = 140;
    const ov = overrideFromDraft("macros", draft);
    expect(ov?.recommendedKey).toBe("low-carb");
    expect(ov?.styles?.["low-carb"]).toEqual({ proteinG: 140, carbsG: 100, fatsG: 78 });
  });

  it("training: session text cells round-trip with name/kind carried", () => {
    const r = coreResult();
    const draft = buildDraft("training", r) as TrainingDraft;
    expect(draft.stepTarget).toBe(8000);
    expect(draft.sessions[0].name).toBe("Day A");
    draft.sessions[0].blocks[0].exercises = "Trap Bar Deadlift";
    const ov = overrideFromDraft("training", draft);
    expect(ov?.sessions?.[0].blocks[0].exercises).toBe("Trap Bar Deadlift");
    expect(ov?.sessions?.[0].name).toBe("Day A");
    expect(ov?.stepTarget).toBe(8000);
  });

  it("coachNotes draft is the raw text; it is NOT an override (top-level field)", () => {
    const r = coreResult();
    r.coachNotes = "Line one.\n\nLine two.";
    const draft = buildDraft("coachNotes", r) as CoachNotesDraft;
    expect(draft.text).toBe("Line one.\n\nLine two.");
    expect(overrideFromDraft("coachNotes", draft)).toBeUndefined();
  });

  it("welcome draft carries the effective header names", () => {
    const r = coreResult();
    r.headerOverride = { businessName: null };
    const draft = buildDraft("welcome", r) as WelcomeDraft;
    expect(draft.trainerName).toBe("Coach");
    expect(draft.businessName).toBe(""); // hidden → blank field
  });
});

describe("validateCardDraft — honest rejections, never silent clamps", () => {
  it("welcome: empty title/message rejected", () => {
    const d: WelcomeDraft = { title: "  ", message: "hi", trainerName: "Coach", businessName: "" };
    expect(validateCardDraft("welcome", d)).toMatch(/title/i);
    d.title = "Hi"; d.message = "";
    expect(validateCardDraft("welcome", d)).toMatch(/message/i);
    d.message = "ok";
    expect(validateCardDraft("welcome", d)).toBeNull();
  });

  it("assessment: out-of-range numbers rejected, nulls flagged", () => {
    const ok: AssessmentDraft = { weightKg: 90, heightCm: 170, bodyFatPct: null, goalStatement: "g" };
    expect(validateCardDraft("assessment", ok)).toBeNull();
    expect(validateCardDraft("assessment", { ...ok, weightKg: 600 })).toMatch(/weight/i);
    expect(validateCardDraft("assessment", { ...ok, heightCm: 90 })).toMatch(/height/i);
    expect(validateCardDraft("assessment", { ...ok, bodyFatPct: 80 })).toMatch(/body fat/i);
    expect(validateCardDraft("assessment", { ...ok, goalStatement: " " })).toMatch(/goal/i);
  });

  it("calories: below the 1,200 kcal safety floor is rejected", () => {
    expect(validateCardDraft("calories", { target: 1199, deficitPct: 10 } as CaloriesDraft)).toMatch(/1,200/);
    expect(validateCardDraft("calories", { target: 5000, deficitPct: 51 } as CaloriesDraft)).toMatch(/deficit/i);
    expect(validateCardDraft("calories", { target: 1700, deficitPct: 23 } as CaloriesDraft)).toBeNull();
  });

  it("macros: unknown recommended key + impossible grams rejected", () => {
    const d: MacrosDraft = {
      recommendedKey: "balanced",
      styles: [{ key: "balanced", name: "Balanced", proteinG: 150, carbsG: 170, fatsG: 60 }],
    };
    expect(validateCardDraft("macros", d)).toBeNull();
    expect(validateCardDraft("macros", { ...d, recommendedKey: "nope" })).toMatch(/recommended/i);
    expect(validateCardDraft("macros", { ...d, styles: [{ ...d.styles[0], proteinG: -1 }] })).toMatch(/negative/i);
    expect(validateCardDraft("macros", { ...d, styles: [{ ...d.styles[0], carbsG: 2000 }] })).toMatch(/too high/i);
  });

  it("training: empty exercise cell rejected; coachNotes always valid", () => {
    const d: TrainingDraft = {
      stepTarget: 8000,
      restRules: ["r"],
      sessions: [{ name: "Day A", kind: "trainer", blocks: [{ label: "A1", exercises: " ", setsReps: "4×10", tempo: "4010", rest: "60s" }] }],
    };
    expect(validateCardDraft("training", d)).toMatch(/exercise/i);
    d.sessions[0].blocks[0].exercises = "Squat";
    expect(validateCardDraft("training", d)).toBeNull();
    expect(validateCardDraft("coachNotes", { text: "anything <goes>" } as CoachNotesDraft)).toBeNull();
  });
});

describe("headerOverrideFromDraft — diff-only persistence", () => {
  it("untouched header → empty override (card not marked Edited)", () => {
    const r = coreResult();
    const d = buildDraft("welcome", r) as WelcomeDraft;
    expect(headerOverrideFromDraft(d, r)).toEqual({});
  });

  it("changed names persist; blanked business hides it; blank trainer ignored", () => {
    const r = coreResult();
    const d: WelcomeDraft = { title: "t", message: "m", trainerName: "Alex Z", businessName: "" };
    expect(headerOverrideFromDraft(d, r)).toEqual({ trainerName: "Alex Z", businessName: null });
    d.trainerName = "   ";
    expect(headerOverrideFromDraft(d, r)).toEqual({ businessName: null });
    d.businessName = "AzFIT Studio";
    expect(headerOverrideFromDraft(d, r)).toEqual({});
  });
});
