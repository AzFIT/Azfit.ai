import { describe, it, expect } from "vitest";
import {
  computeBodyAndCalories,
  macroGrams,
  proteinFloor,
  buildMacroTable,
  recommendStyle,
  isFatLossGoal,
  computeExpectedOutcomes,
  buildRoadmap,
  buildGbcPlan,
  buildSampleDay,
  buildFaq,
  computeBlueprint,
  resolveActivityMultiplier,
  MACRO_STYLES,
  type BlueprintInputs,
} from "./planBlueprint";

/* ── The owner's real fixture: F 45 / 173 cm / 81 kg / 31.1% BF ── */
const FIXTURE = { gender: "female" as const, age: 45, heightCm: 173, weightKg: 81, bodyFatPct: 31.1, activityKey: "office", pace: "standard" as const };

describe("computeBodyAndCalories (fixture)", () => {
  const cal = computeBodyAndCalories(FIXTURE);
  it("Katch-McArdle BMR ≈ 1575 when BF% known", () => {
    expect(cal.bmrMethod).toBe("katch-mcardle");
    expect(cal.bmr).toBeCloseTo(1575, 0);
    expect(cal.leanMassKg).toBeCloseTo(55.8, 1);
    expect(cal.fatMassKg).toBeCloseTo(25.2, 1);
  });
  it("TDEE @ 1.4 = 2205, maintenance rounded to 2200", () => {
    expect(cal.tdee).toBe(2205);
    expect(cal.maintenance).toBe(2200);
  });
  it("20% standard deficit → 1760, not clamped", () => {
    expect(cal.target).toBe(1760);
    expect(cal.deficitPerDay).toBe(440);
    expect(cal.clampedByFloor).toBe(false);
  });
  it("Mifflin fallback when BF% is null", () => {
    const c = computeBodyAndCalories({ ...FIXTURE, bodyFatPct: null });
    expect(c.bmrMethod).toBe("mifflin");
    expect(c.bmr).toBe(1505); // 10×81 + 6.25×173 − 5×45 − 161
    expect(c.leanMassKg).toBeNull();
  });
  it("hard floor clamps + flags when the deficit goes too deep", () => {
    const c = computeBodyAndCalories({ gender: "female", age: 30, heightCm: 160, weightKg: 50, bodyFatPct: null, activityKey: "sedentary", pace: "aggressive" });
    // BMR 1189 → maintenance round50(1427)=1450; 25% → 1090; floor max(1248, 1200) → 1250
    expect(c.target).toBe(1250);
    expect(c.clampedByFloor).toBe(true);
  });
});

describe("resolveActivityMultiplier", () => {
  it("office job + 3 sessions = 1.4 (conservative bias)", () => {
    expect(resolveActivityMultiplier("office")).toBe(1.4);
  });
  it("existing keys pass through; unknown defaults to office", () => {
    expect(resolveActivityMultiplier("moderate")).toBe(1.55);
    expect(resolveActivityMultiplier("nonsense")).toBe(1.4);
  });
});

describe("macroGrams + styles table", () => {
  it("grams from pct with 4/4/9 rounding", () => {
    const g = macroGrams(1760, [35, 35, 30]);
    expect(g).toEqual({ proteinG: 154, carbsG: 154, fatsG: 59 });
  });
  it("protein floor from lean mass, capped at 2.2 g/kg", () => {
    expect(proteinFloor(81, 55.8).grams).toBe(123); // 2.2 × 55.8
    expect(proteinFloor(81, null).grams).toBe(146); // 1.8 × 81
    expect(proteinFloor(50, 45).grams).toBe(99); // 2.2×45=99 (under the 2.2×50 cap)
  });
  it("table flags styles below the floor (Balanced @1760 < 123 g)", () => {
    const table = buildMacroTable(1760, 2200, 123);
    const balanced = table.find((s) => s.key === "balanced")!;
    const highProtein = table.find((s) => s.key === "high-protein")!;
    expect(balanced.atTarget.belowFloor).toBe(true);
    expect(balanced.atTarget.note).toContain("trimming carbs");
    expect(highProtein.atTarget.belowFloor).toBe(false);
    expect(table).toHaveLength(5);
    expect(balanced.atMaintenance.proteinG).toBe(138); // 2200×0.25/4
  });
  it("recommended style: High Protein for fat loss, Balanced otherwise", () => {
    expect(recommendStyle(true).key).toBe("high-protein");
    expect(recommendStyle(false).key).toBe("balanced");
    expect(MACRO_STYLES.some((s) => s.key === recommendStyle(true).key)).toBe(true);
  });
});

describe("computeExpectedOutcomes (fixture)", () => {
  const o = computeExpectedOutcomes(440, 16, 81, 31.1);
  it("weekly rate 0.4 kg, range ±20%", () => {
    expect(o.weeklyLossKg).toBe(0.4);
    expect(o.weeklyLossRange).toEqual([0.32, 0.48]);
  });
  it("projected weight + BF% at program end (all-fat assumption)", () => {
    expect(o.projectedFatLossKg).toBe(6.4);
    expect(o.endWeightKg).toBeCloseTo(74.6, 1);
    expect(o.endBodyFatPct).toBeCloseTo(25.2, 1);
  });
  it("null BF → null endBodyFatPct", () => {
    expect(computeExpectedOutcomes(440, 16, 81, null).endBodyFatPct).toBeNull();
  });
});

describe("buildRoadmap", () => {
  it("16 weeks with diet break: habit → main → break → push → re-assessment", () => {
    const r = buildRoadmap(16, true, 1760, 2200);
    expect(r.map((p) => p.weeks)).toEqual(["1–2", "3–10", "11–12", "13–15", "16"]);
    expect(r[2].name).toBe("Diet Break");
    expect(r[2].note).toContain("2,200");
    expect(r[r.length - 1].name).toBe("Re-assessment");
  });
  it("no break when disabled or program < 12 weeks", () => {
    expect(buildRoadmap(16, false, 1760, 2200).some((p) => p.name === "Diet Break")).toBe(false);
    expect(buildRoadmap(8, true, 1760, 2200).some((p) => p.name === "Diet Break")).toBe(false);
    expect(buildRoadmap(8, true, 1760, 2200).map((p) => p.weeks)).toEqual(["1–2", "3–7", "8"]);
  });
});

describe("buildGbcPlan", () => {
  it("2 trainer + 1 solo → A, B, C", () => {
    const s = buildGbcPlan(2, 1);
    expect(s.map((x) => x.kind)).toEqual(["trainer", "trainer", "solo"]);
    expect(s[0].blocks[0].exercises).toBe("Goblet Squat");
    expect(s[1].blocks[0].exercises).toBe("Seated DB Shoulder Press");
    expect(s[2].rounds).toContain("3 rounds");
  });
  it("scales to the actual split (1+1 → A + C; 0 trainer → solo only)", () => {
    expect(buildGbcPlan(1, 1).map((x) => x.kind)).toEqual(["trainer", "solo"]);
    expect(buildGbcPlan(0, 2).every((x) => x.kind === "solo")).toBe(true);
  });
});

describe("buildSampleDay", () => {
  it("lands within ±5% of the High-Protein fat-loss targets (fixture)", () => {
    const d = buildSampleDay(1760, 154, 154, 59);
    expect(d.withinTolerance).toBe(true);
    expect(Math.abs(d.totals.p - 154) / 154).toBeLessThanOrEqual(0.06);
    expect(Math.abs(d.totals.c - 154) / 154).toBeLessThanOrEqual(0.06);
    expect(Math.abs(d.totals.kcal - 1760) / 1760).toBeLessThanOrEqual(0.06);
    expect(d.meals).toHaveLength(5);
    expect(d.meals[2].items[0]).toContain("Whey protein");
  });
  it("adapts anchors to higher calories (maintenance 2200 Balanced)", () => {
    const d = buildSampleDay(2200, 138, 248, 73);
    expect(d.withinTolerance).toBe(true);
  });
});

describe("buildFaq + computeBlueprint integration", () => {
  it("bulking Q&A only for female fat-loss clients", () => {
    expect(buildFaq(true)[0].q).toContain("bulk");
    expect(buildFaq(false).every((f) => !f.q.includes("bulk"))).toBe(true);
    expect(buildFaq(false)).toHaveLength(4);
  });

  const inputs: BlueprintInputs = {
    ...FIXTURE,
    trainerSessionsPerWeek: 2,
    soloSessionsPerWeek: 1,
    stepTarget: 9000,
    goalType: "reduce_body_fat",
    programWeeks: 16,
    dietBreak: true,
    trainerName: "Coach Demo",
    businessName: "AzFIT Studio",
  };
  const bp = computeBlueprint(inputs, "2026-08-10T00:00:00.000Z");

  it("full model assembles coherently (fixture end-to-end)", () => {
    expect(bp.assessment.bmrMethod).toBe("katch-mcardle");
    expect(bp.assessment.bmi).toBeCloseTo(27.1, 1);
    expect(bp.calories.target).toBe(1760);
    expect(bp.recommended.key).toBe("high-protein");
    expect(bp.outcomes?.weeklyLossKg).toBe(0.4);
    expect(bp.goal.statement).toContain("31.1% → 25.2%");
    expect(bp.goal.statement).toContain("0.32–0.48 kg/week");
    expect(bp.femaleReassurance).toBe(true);
    expect(bp.faq[0].q).toContain("bulk");
    expect(bp.training.sessions).toHaveLength(3);
    expect(bp.sampleDay.withinTolerance).toBe(true);
    expect(bp.roadmap).toHaveLength(5);
    expect(bp.tracking).toHaveLength(6);
    expect(bp.foodRules).toHaveLength(6);
    expect(bp.header.businessName).toBe("AzFIT Studio");
  });

  it("non-fat-loss goal → maintenance target, no outcomes, no reassurance", () => {
    const m = computeBlueprint({ ...inputs, gender: "male", goalType: "build_muscle" });
    expect(m.goal.isFatLoss).toBe(false);
    expect(m.outcomes).toBeNull();
    expect(m.recommended.key).toBe("balanced");
    expect(m.femaleReassurance).toBe(false);
  });

  it("isFatLossGoal vocabulary", () => {
    expect(isFatLossGoal("lose_weight")).toBe(true);
    expect(isFatLossGoal("reduce_body_fat")).toBe(true);
    expect(isFatLossGoal("build_muscle")).toBe(false);
    expect(isFatLossGoal("increase_strength")).toBe(false);
  });
});
