/* Phase 99c Item 3 — blueprintWeeklyTargets unit tests. */
import { describe, expect, it } from "vitest";
import { buildWeeklyTargets } from "./blueprintWeeklyTargets";

const base = {
  nowIso: "2026-09-17T00:00:00.000Z",
  first: { recordedAt: "2026-01-05", weightKg: 90, bodyFatPct: 28 },
  latest: { recordedAt: "2026-09-01", weightKg: 84, bodyFatPct: 24 },
  goalRow: {
    goal_type: "lose_weight",
    custom_label: null,
    target_weight_kg: 80,
    target_body_fat_pct: null,
    target_date: null,
    notes: null,
  },
  weightKgNow: 84,
  programWeeks: 16,
  isFatLoss: true,
  gender: "male",
};

describe("buildWeeklyTargets", () => {
  it("uses the FIRST recorded measurement as the baseline", () => {
    const r = buildWeeklyTargets(base);
    expect(r.baseline.weightKg).toBe(90);
    expect(r.baseline.recordedAt).toBe("2026-01-05");
  });

  it("computes the 0.5–1% weekly rate from baseline weight", () => {
    const r = buildWeeklyTargets(base);
    expect(r.weeklyRate).not.toBeNull();
    expect(r.weeklyRate!.minKg).toBeCloseTo(0.5 * 0.9, 1); // 90 × 0.005
    expect(r.weeklyRate!.maxKg).toBe(0.9); // 90 × 0.01
    expect(r.weeklyRate!.label).toContain("0.5–0.9");
  });

  it("flags an unrealistic goal date honestly and gives a real week estimate", () => {
    const r = buildWeeklyTargets({
      ...base,
      goalRow: { ...base.goalRow, target_date: "2026-10-01" }, // ~4 weeks to lose 10 kg
    });
    expect(r.goalDateHonestNote).not.toBeNull();
    expect(r.goalDateHonestNote).toMatch(/faster than the safe maximum/);
    expect(r.realisticWeeksEstimate).not.toBeNull();
  });

  it("accepts a realistic goal date without a warning", () => {
    const r = buildWeeklyTargets({
      ...base,
      goalRow: { ...base.goalRow, target_date: "2027-01-01" },
    });
    expect(r.goalDateHonestNote).toBeNull();
  });

  it("expectations stay within the program length", () => {
    const r = buildWeeklyTargets({ ...base, programWeeks: 8 });
    for (const e of r.expectations) {
      const end = parseInt(e.weeks.match(/(\d+)$/)![1], 10);
      expect(end).toBeLessThanOrEqual(8);
    }
  });

  it("non-fat-loss plan has no weekly weight rate", () => {
    const r = buildWeeklyTargets({ ...base, isFatLoss: false, goalRow: { ...base.goalRow, goal_type: "build_muscle", target_weight_kg: null } });
    expect(r.weeklyRate).toBeNull();
    expect(r.expectations[0].focus).toMatch(/Technique/);
  });

  it("missing measurements produce honest notes, never zeros", () => {
    const r = buildWeeklyTargets({ ...base, first: null, latest: null, weightKgNow: null });
    expect(r.baseline.weightKg).toBeNull();
    expect(r.weeklyRate).toBeNull();
    expect(r.notes.join(" ")).toMatch(/first weigh-in/);
  });
});
