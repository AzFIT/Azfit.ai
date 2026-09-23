/* Phase 99c Item 2 — blueprintCardio unit tests. */
import { describe, expect, it } from "vitest";
import { buildCardioPlan } from "./blueprintCardio";

const base = {
  goalType: "lose_weight",
  equipmentAccess: "full_gym" as const,
  sessionsPerWeek: 3,
  stepTarget: 9000,
  experience: "intermediate" as const,
};

describe("buildCardioPlan", () => {
  it("fat-loss plan = 2 LISS + 1 intervals with real machines", () => {
    const p = buildCardioPlan(base);
    expect(p.rows).toHaveLength(3);
    expect(p.rows.filter((r) => r.protocol.startsWith("LISS"))).toHaveLength(2);
    expect(p.rows.filter((r) => r.protocol.startsWith("Intervals"))).toHaveLength(1);
    for (const r of p.rows) {
      expect(r.machine.length).toBeGreaterThan(0);
      expect(r.difficulty).toBeTruthy();
      expect(r.intensity).toMatch(/RPE/);
      expect(r.basis.length).toBeGreaterThan(0);
      expect(r.progression).toHaveLength(4);
    }
  });

  it("bodyweight-only fat loss falls back to walking, never machines", () => {
    const p = buildCardioPlan({ ...base, equipmentAccess: "bodyweight_only" });
    expect(p.rows.every((r) => !/Treadmill|Bike|Rowing|Stair|Elliptical|Swimming/i.test(r.machine))).toBe(true);
    expect(p.rows.some((r) => /walk|sprint/i.test(r.machine))).toBe(true);
  });

  it("strength goal yields low-intensity cardio only + honest note", () => {
    const p = buildCardioPlan({ ...base, goalType: "build_muscle" });
    expect(p.rows.every((r) => r.protocol === "LISS — steady-state low intensity")).toBe(true);
    expect(p.notes.join(" ")).toMatch(/Strength goal/);
  });

  it("beginner durations are scaled down (75%) and capped Beginner", () => {
    const adv = buildCardioPlan(base);
    const beg = buildCardioPlan({ ...base, experience: "beginner" });
    const advLiss = adv.rows.find((r) => r.protocol.startsWith("LISS"))!;
    const begLiss = beg.rows.find((r) => r.protocol.startsWith("LISS"))!;
    expect(begLiss.difficulty).toBe("Beginner");
    const advMin = parseInt(advLiss.basis.match(/(\d+)–/)![1], 10);
    const begMin = parseInt(begLiss.basis.match(/(\d+)–/)![1], 10);
    expect(begMin).toBe(Math.round(advMin * 0.75));
  });

  it("step note carries the real step target", () => {
    const p = buildCardioPlan({ ...base, stepTarget: 12000 });
    expect(p.stepNote).toContain("12,000");
  });

  it("weeklyMinutes is a positive whole number", () => {
    const p = buildCardioPlan(base);
    expect(Number.isInteger(p.weeklyMinutes)).toBe(true);
    expect(p.weeklyMinutes).toBeGreaterThan(0);
  });
});
