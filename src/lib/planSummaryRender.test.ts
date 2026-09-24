/* Phase 99e Item 1 — planSummaryRender (shared section resolver) tests. */
import { describe, expect, it } from "vitest";
import {
  resolvePlanSummary,
  resolveByKey,
  displayTitle,
  FEMALE_NOTE_TEXT,
} from "./planSummaryRender";
import type { BlueprintResult } from "./planBlueprint";

function baseResult(): BlueprintResult {
  return {
    header: { generatedIso: "2026-03-01T10:00:00", trainerName: "Coach", businessName: null },
    assessment: {
      weightKg: 90,
      heightCm: 170,
      bmi: 31.1,
      bodyFatPct: 28,
      fatMassKg: 25.2,
      leanMassKg: 64.8,
      bmr: 1650,
      bmrMethod: "mifflin-st-jeor",
      maintenance: 2200,
    },
    goal: { statement: "Lose 10 kg", isFatLoss: true, programWeeks: 12 },
    calories: { target: 1700, maintenance: 2200, deficitPct: 0.22, clampedByFloor: false },
    outcomes: { weeklyLossKg: 0.7 },
    macroStyles: [
      {
        key: "balanced",
        name: "Balanced",
        bestFor: "most people",
        atTarget: { proteinG: 150, carbsG: 170, fatsG: 60, belowFloor: false },
        atMaintenance: { proteinG: 150, carbsG: 250, fatsG: 80, belowFloor: false },
      },
    ],
    recommended: { key: "balanced", name: "Balanced", reason: "sustainable" },
    proteinFloor: { grams: 130, basis: "2.0 g/kg target weight" },
    training: { sessions: [{ name: "Day A", blocks: [], rounds: null, finisher: null }], restRules: ["rest 60s"], stepTarget: 8000 },
    trainingMeta: { notes: ["method: GBC"] },
    foodRules: ["eat protein"],
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
    cardio: { rows: [{ machine: "Exercise bike", protocol: "LISS", difficulty: "Beginner", intensity: "RPE 4–5", basis: "20 min", schedule: "2×/week", progression: [] }], weeklyMinutes: 40, stepNote: "aim for steps", notes: [] },
    nutritionGuide: { title: "Eating well", intro: "intro", blocks: [{ heading: "Protein", points: ["eat it"] }], safetyCallout: null, whoShouldNotCut: ["pregnant"], notes: [] },
    sampleDay: { meals: [{ name: "Breakfast", items: ["eggs"], macros: { kcal: 400, p: 30, c: 20, f: 20 } }], totals: { kcal: 400, p: 30, c: 20, f: 20 }, withinTolerance: true },
    tracking: [{ what: "Weight", frequency: "Daily", note: "morning" }],
    faq: [{ q: "Q?", a: "A." }],
    roadmap: [{ weeks: "1-4", name: "Base", kcal: "", note: "n" }] as unknown as BlueprintResult["roadmap"],
  } as unknown as BlueprintResult;
}

describe("resolvePlanSummary — order, presence, numbering", () => {
  it("welcome is the unnumbered cover, numbered sections are contiguous 1..N in report order", () => {
    const sections = resolvePlanSummary(baseResult());
    expect(sections[0].key).toBe("welcome");
    expect(sections[0].number).toBe(0);
    const numbered = sections.filter((s) => s.key !== "welcome");
    expect(numbered.map((s) => s.number)).toEqual(numbered.map((_, i) => i + 1));
    expect(numbered.map((s) => s.key)).toEqual([
      "assessment",
      "calories",
      "macros",
      "weeklyTargets",
      "training",
      "cardio",
      "nutritionGuide",
      "sampleDay",
      "tracking",
      "roadmap",
      "faq",
    ]);
  });

  it("old summaries without 99c cards resolve without them", () => {
    const r = baseResult();
    delete r.cardio;
    delete r.nutritionGuide;
    delete r.weeklyTargets;
    const keys = resolvePlanSummary(r).map((s) => s.key);
    expect(keys).not.toContain("cardio");
    expect(keys).not.toContain("nutritionGuide");
    expect(keys).not.toContain("weeklyTargets");
    // numbering stays contiguous
    const numbered = resolvePlanSummary(r).filter((s) => s.key !== "welcome");
    expect(numbered.map((s) => s.number)).toEqual(numbered.map((_, i) => i + 1));
  });

  it("female note slots in after assessment when present", () => {
    const r = baseResult();
    r.femaleReassurance = true;
    const sections = resolvePlanSummary(r);
    const fa = sections.find((s) => s.key === "femaleNote");
    expect(fa?.number).toBe(2);
    expect(fa && "data" in fa && fa.data.text).toBe(FEMALE_NOTE_TEXT);
  });
});

describe("resolvePlanSummary — include ticks", () => {
  it("excluded sections are absent and remaining sections renumber", () => {
    const r = baseResult();
    r.included = { macros: false, cardio: false };
    const sections = resolvePlanSummary(r);
    const keys = sections.map((s) => s.key);
    expect(keys).not.toEqual(expect.arrayContaining(["macros", "cardio"]));
    const weeklyTargets = sections.find((s) => s.key === "weeklyTargets");
    // 1 assessment, 2 calories, 3 weeklyTargets (macros skipped)
    expect(weeklyTargets?.number).toBe(3);
  });

  it("excluded welcome cover is absent", () => {
    const r = baseResult();
    r.included = { welcome: false };
    const sections = resolvePlanSummary(r);
    expect(sections[0].key).toBe("assessment");
    expect(sections[0].number).toBe(1);
  });
});

describe("resolvePlanSummary — overrides and display data", () => {
  it("override values win in resolved section data (base never mutated)", () => {
    const r = baseResult();
    const baseMessage = r.welcome!.message;
    r.overrides = { welcome: { message: "Edited welcome." } };
    const welcome = resolvePlanSummary(r)[0];
    expect(welcome.key).toBe("welcome");
    if (welcome.key === "welcome") {
      expect(welcome.data.message).toBe("Edited welcome.");
      expect(welcome.data.title).toBe("Welcome aboard, Sam!");
    }
    expect(r.welcome!.message).toBe(baseMessage);
  });

  it("dynamic titles resolve (training sessions, roadmap weeks, sample-day style)", () => {
    const sections = resolvePlanSummary(baseResult());
    const by = new Map(sections.map((s) => [s.key, s]));
    expect(by.get("training")?.title).toContain("1 sessions");
    expect(by.get("training")?.title).toContain("8,000 steps/day");
    expect(by.get("roadmap")?.title).toBe("Program Roadmap (12 weeks)");
    expect(by.get("sampleDay")?.title).toBe("Sample Day of Eating (Balanced)");
    expect(by.get("nutritionGuide")?.title).toBe("Eating well");
  });

  it("weekly-targets display strings are precomputed", () => {
    const wt = resolvePlanSummary(baseResult()).find((s) => s.key === "weeklyTargets");
    expect(wt).toBeDefined();
    if (wt?.key === "weeklyTargets") {
      expect(wt.data.baselineWeightDisplay).toBe("90 kg");
      expect(wt.data.baselineSub).toContain("28% body fat");
      expect(wt.data.baselineSub).toContain("first logged January 5, 2026");
      expect(wt.data.goalDisplay).toBe("80 kg");
      expect(wt.data.goalSub).toBe("fat loss");
    }
  });

  it("assessment data carries the goal statement and honest nulls", () => {
    const a = resolvePlanSummary(baseResult()).find((s) => s.key === "assessment");
    if (a?.key === "assessment") {
      expect(a.data.goalStatement).toBe("Lose 10 kg");
      expect(a.data.bmrMethod).toBe("mifflin-st-jeor");
    }
    const r = baseResult();
    r.assessment.bodyFatPct = null;
    const a2 = resolvePlanSummary(r).find((s) => s.key === "assessment");
    if (a2?.key === "assessment") expect(a2.data.bodyFatPct).toBeNull();
  });
});

describe("resolveByKey + displayTitle", () => {
  it("map lookup returns only present+included sections", () => {
    const r = baseResult();
    r.included = { faq: false };
    const by = resolveByKey(r);
    expect(by.has("faq")).toBe(false);
    expect(by.get("cardio")?.key).toBe("cardio");
  });

  it("displayTitle prefixes the number for numbered sections only", () => {
    const sections = resolvePlanSummary(baseResult());
    const welcome = sections[0];
    expect(displayTitle(welcome)).toBe("Welcome aboard, Sam!");
    const calories = sections.find((s) => s.key === "calories")!;
    expect(displayTitle(calories)).toBe(`${calories.number} · Calorie Targets`);
  });
});

describe("Phase 99g — core-card effective data + Coach's Notes", () => {
  it("coachNotes resolves last, numbered after faq, only when text exists", () => {
    const r = baseResult();
    expect(resolvePlanSummary(r).map((s) => s.key)).not.toContain("coachNotes");
    r.coachNotes = "P1\n\nP2";
    const sections = resolvePlanSummary(r);
    const cn = sections[sections.length - 1];
    expect(cn.key).toBe("coachNotes");
    if (cn.key === "coachNotes") {
      expect(cn.data.paragraphs).toEqual(["P1", "P2"]);
      expect(cn.title).toBe("Coach's Notes");
    }
    const faq = sections.find((s) => s.key === "faq")!;
    expect(cn.number).toBe(faq.number + 1);
  });

  it("include tick excludes coachNotes everywhere", () => {
    const r = baseResult();
    r.coachNotes = "notes";
    r.included = { coachNotes: false };
    expect(resolvePlanSummary(r).map((s) => s.key)).not.toContain("coachNotes");
    expect(resolveByKey(r).has("coachNotes")).toBe(false);
  });

  it("calories override flows into resolved data with a recomputed weekly loss", () => {
    const r = baseResult();
    r.overrides = { calories: { target: 2000 } };
    const c = resolvePlanSummary(r).find((s) => s.key === "calories");
    if (c?.key === "calories") {
      expect(c.data.target).toBe(2000);
      expect(c.data.overridden).toBe(true);
      expect(c.data.deficitPct).toBeCloseTo((2200 - 2000) / 2200, 4);
      // (2200-2000)*7/7700 = 0.18 kg/week
      expect(c.data.weeklyLossKg).toBeCloseTo(0.18, 2);
    } else {
      throw new Error("calories section missing");
    }
    // un-edited: base outcome flows through
    const base = resolvePlanSummary(baseResult()).find((s) => s.key === "calories");
    if (base?.key === "calories") expect(base.data.weeklyLossKg).toBe(0.7);
  });

  it("macros + training overrides flow into resolved data and titles", () => {
    const r = baseResult();
    r.overrides = {
      macros: { styles: { balanced: { proteinG: 100, carbsG: 170, fatsG: 60 } } },
      training: { stepTarget: 12000 },
    };
    const m = resolvePlanSummary(r).find((s) => s.key === "macros");
    if (m?.key === "macros") {
      expect(m.data.styles[0].atTarget.proteinG).toBe(100);
      expect(m.data.styles[0].atTarget.belowFloor).toBe(true); // < 130 g floor
      expect(m.data.anyBelowFloor).toBe(true);
    } else throw new Error("macros section missing");
    const t = resolvePlanSummary(r).find((s) => s.key === "training");
    expect(t?.title).toContain("12,000 steps/day");
    if (t?.key === "training") expect(t.data.stepTarget).toBe(12000);
  });

  it("assessment override recomputes derived values in the resolved card", () => {
    const r = baseResult();
    r.overrides = { assessment: { weightKg: 100, goalStatement: "Custom goal" } };
    const a = resolvePlanSummary(r).find((s) => s.key === "assessment");
    if (a?.key === "assessment") {
      expect(a.data.weightKg).toBe(100);
      expect(a.data.bmi).toBeCloseTo(100 / 1.7 ** 2, 1);
      expect(a.data.goalStatement).toBe("Custom goal");
      expect(a.data.bmr).toBe(1650);
    } else throw new Error("assessment section missing");
  });
});
