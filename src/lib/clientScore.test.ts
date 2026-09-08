import { describe, it, expect } from "vitest";
import { computeClientScore, scoreLabel, SCORE_WEIGHTS } from "./clientScore";

const FULL = {
  sessionsCompleted28d: 8,
  sessionsScheduled28d: 10, // 80%
  planDone7d: 5,
  planTotal7d: 10, // 50%
  habitDaysAllMet7d: 4,
  habitDaysWithLogs7d: 7, // ~57.1%
  hasLifestyleTargets: true,
  checkinsSubmitted28d: 4, // 100% (4/4)
};

describe("computeClientScore", () => {
  it("computes the exact weighted score with all components present", () => {
    const r = computeClientScore(FULL);
    // 0.4*80 + 0.25*50 + 0.2*(4/7*100) + 0.15*100
    // = 32 + 12.5 + 11.428… + 15 = 70.93 → 71
    expect(r.score).toBe(71);
    expect(r.label).toBe("Strong");
    expect(r.components.every((c) => c.pct !== null)).toBe(true);
  });

  it("renormalizes weights when a component has no data", () => {
    const r = computeClientScore({ ...FULL, planDone7d: 0, planTotal7d: 0 });
    const plan = r.components.find((c) => c.key === "plan")!;
    expect(plan.pct).toBeNull();
    expect(plan.detail).toBe("Not enough data yet");
    // weights: 0.4+0.2+0.15 = 0.75 → (32 + 11.428… + 15) / 0.75 = 77.9 → 78
    expect(r.score).toBe(78);
  });

  it("excludes habits when no lifestyle targets are set", () => {
    const r = computeClientScore({ ...FULL, hasLifestyleTargets: false });
    expect(r.components.find((c) => c.key === "habits")!.pct).toBeNull();
  });

  it("excludes habits when targets exist but no habit-log days", () => {
    const r = computeClientScore({ ...FULL, habitDaysAllMet7d: 0, habitDaysWithLogs7d: 0 });
    expect(r.components.find((c) => c.key === "habits")!.pct).toBeNull();
  });

  it("excludes training when no sessions are scheduled", () => {
    const r = computeClientScore({ ...FULL, sessionsCompleted28d: 0, sessionsScheduled28d: 0 });
    expect(r.components.find((c) => c.key === "training")!.pct).toBeNull();
  });

  it("treats zero check-in submissions as no data (not a real 0%)", () => {
    const r = computeClientScore({ ...FULL, checkinsSubmitted28d: 0 });
    expect(r.components.find((c) => c.key === "checkins")!.pct).toBeNull();
  });

  it("caps check-in engagement at 100%", () => {
    const r = computeClientScore({ ...FULL, checkinsSubmitted28d: 9 });
    expect(r.components.find((c) => c.key === "checkins")!.pct).toBe(100);
  });

  it("returns the honest empty state (null score) when ALL components lack data", () => {
    const r = computeClientScore({
      sessionsCompleted28d: 0,
      sessionsScheduled28d: 0,
      planDone7d: 0,
      planTotal7d: 0,
      habitDaysAllMet7d: 0,
      habitDaysWithLogs7d: 0,
      hasLifestyleTargets: false,
      checkinsSubmitted28d: 0,
    });
    expect(r.score).toBeNull();
    expect(r.label).toBeNull();
  });

  it("a single component with data yields that component's % (weights renormalize to 1)", () => {
    const r = computeClientScore({
      sessionsCompleted28d: 3,
      sessionsScheduled28d: 4,
      planDone7d: 0,
      planTotal7d: 0,
      habitDaysAllMet7d: 0,
      habitDaysWithLogs7d: 0,
      hasLifestyleTargets: false,
      checkinsSubmitted28d: 0,
    });
    expect(r.score).toBe(75);
    expect(r.label).toBe("Strong");
  });

  it("details report raw inputs honestly", () => {
    const r = computeClientScore(FULL);
    expect(r.components.find((c) => c.key === "training")!.detail).toBe("8 of 10 sessions completed");
    expect(r.components.find((c) => c.key === "checkins")!.detail).toBe("4 of 4 weekly check-ins");
  });
});

describe("scoreLabel", () => {
  it("maps the bands exactly", () => {
    expect(scoreLabel(0)).toBe("Getting Started");
    expect(scoreLabel(39)).toBe("Getting Started");
    expect(scoreLabel(40)).toBe("Building Momentum");
    expect(scoreLabel(64)).toBe("Building Momentum");
    expect(scoreLabel(65)).toBe("Strong");
    expect(scoreLabel(84)).toBe("Strong");
    expect(scoreLabel(85)).toBe("Excellent");
    expect(scoreLabel(100)).toBe("Excellent");
  });
});

describe("SCORE_WEIGHTS", () => {
  it("sums to 1", () => {
    expect(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(1);
  });
});
