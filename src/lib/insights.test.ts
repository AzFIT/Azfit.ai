import { describe, it, expect } from "vitest";
import { computeInsights, computeStreaks, MAX_CARDS, type InsightsInput } from "./insights";

const BASE: InsightsInput = {
  sessionsCompletedThisWeek: 3,
  sessionsCompletedLastWeek: 1,
  sessionsScheduledThisWeek: 3,
  sessionsScheduledLastWeek: 3,
  currentStreak: 5,
  longestStreak: 12,
  planDoneLastWeek: 6,
  planTotalLastWeek: 7,
  checkinSubmittedThisWeek: true,
  dayOfWeek: 4,
  habitDaysThisWeek: 5,
  habitDaysLastWeek: 3,
};

describe("computeInsights — individual rules", () => {
  it("momentum up fires with real deltas", () => {
    const cards = computeInsights(BASE);
    const m = cards.find((c) => c.key === "momentum-up")!;
    expect(m.text).toBe("2 more workouts than last week — great consistency");
    expect(m.numbers).toContain("3 completed this week vs 1 last week");
    expect(m.tone).toBe("success");
  });

  it("momentum down fires warn with the raw numbers", () => {
    const cards = computeInsights({ ...BASE, sessionsCompletedThisWeek: 0, sessionsCompletedLastWeek: 2 });
    const m = cards.find((c) => c.key === "momentum-down")!;
    expect(m.text).toContain("2 fewer workouts than last week");
    expect(m.numbers).toContain("0 completed this week vs 2 last week");
  });

  it("momentum does NOT fire when a week has no scheduled sessions", () => {
    expect(computeInsights({ ...BASE, sessionsScheduledLastWeek: 0 }).find((c) => c.key.startsWith("momentum"))).toBeUndefined();
    expect(computeInsights({ ...BASE, sessionsScheduledThisWeek: 0 }).find((c) => c.key.startsWith("momentum"))).toBeUndefined();
  });

  it("momentum does NOT fire on a tie (not meaningful)", () => {
    expect(computeInsights({ ...BASE, sessionsCompletedThisWeek: 1 }).find((c) => c.key.startsWith("momentum"))).toBeUndefined();
  });

  it("streak: 'your best yet' only when current == longest", () => {
    expect(computeInsights({ ...BASE, currentStreak: 12 }).find((c) => c.key === "streak")!.text).toBe("12-day streak — your best yet");
    expect(computeInsights(BASE).find((c) => c.key === "streak")!.text).toBe("5-day streak — keep it rolling");
    expect(computeInsights({ ...BASE, currentStreak: 2 }).find((c) => c.key === "streak")).toBeUndefined();
  });

  it("plan completion fires only at ≥80% with data", () => {
    // isolate the rule (the top-3 cap would otherwise drop it vs stronger cards)
    const quiet: InsightsInput = {
      ...BASE,
      sessionsScheduledThisWeek: 0,
      sessionsScheduledLastWeek: 0,
      currentStreak: 0,
      habitDaysThisWeek: 0,
      habitDaysLastWeek: 0,
    };
    expect(computeInsights(quiet).find((c) => c.key === "plan")!.text).toBe("You ticked off 86% of your plan last week");
    expect(computeInsights({ ...quiet, planDoneLastWeek: 5 }).find((c) => c.key === "plan")).toBeUndefined(); // 71%
    expect(computeInsights({ ...quiet, planTotalLastWeek: 0 }).find((c) => c.key === "plan")).toBeUndefined();
  });

  it("check-in reminder: not submitted AND ≥3 days into the week", () => {
    const c = computeInsights({ ...BASE, checkinSubmittedThisWeek: false })!.find((x) => x.key === "checkin-due")!;
    expect(c.tone).toBe("warn");
    expect(c.numbers).toContain("day 4 of 7");
    expect(computeInsights({ ...BASE, checkinSubmittedThisWeek: false, dayOfWeek: 2 }).find((x) => x.key === "checkin-due")).toBeUndefined();
    expect(computeInsights(BASE).find((x) => x.key === "checkin-due")).toBeUndefined();
  });

  it("habit highlight fires only when this week beats last", () => {
    expect(computeInsights(BASE).find((c) => c.key === "habits")!.text).toContain("5 days this week — up from 3");
    expect(computeInsights({ ...BASE, habitDaysThisWeek: 3 }).find((c) => c.key === "habits")).toBeUndefined();
  });
});

describe("computeInsights — ranking, cap, fallback", () => {
  it("caps at MAX_CARDS", () => {
    const everything: InsightsInput = {
      ...BASE,
      checkinSubmittedThisWeek: false,
      sessionsCompletedThisWeek: 5,
      currentStreak: 30,
      longestStreak: 30,
    };
    const cards = computeInsights(everything);
    expect(cards.length).toBe(MAX_CARDS);
  });

  it("warn cards rank before success cards", () => {
    const cards = computeInsights({ ...BASE, checkinSubmittedThisWeek: false });
    expect(cards[0].tone).toBe("warn");
  });

  it("neutral fallback when NO rule fires (never empty, never filler)", () => {
    const cards = computeInsights({
      sessionsCompletedThisWeek: 0,
      sessionsCompletedLastWeek: 0,
      sessionsScheduledThisWeek: 0,
      sessionsScheduledLastWeek: 0,
      currentStreak: 0,
      longestStreak: 0,
      planDoneLastWeek: 0,
      planTotalLastWeek: 0,
      checkinSubmittedThisWeek: true,
      dayOfWeek: 1,
      habitDaysThisWeek: 0,
      habitDaysLastWeek: 0,
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].key).toBe("neutral");
    expect(cards[0].text).toContain("Log a session or habit");
  });
});

describe("computeStreaks", () => {
  it("counts consecutive days ending today", () => {
    const r = computeStreaks(["2026-09-06", "2026-09-07", "2026-09-08"], "2026-09-08");
    expect(r.currentStreak).toBe(3);
    expect(r.longestStreak).toBe(3);
  });

  it("today inactive doesn't break the streak (yesterday anchor)", () => {
    const r = computeStreaks(["2026-09-06", "2026-09-07"], "2026-09-08");
    expect(r.currentStreak).toBe(2);
  });

  it("a gap breaks the current streak but not the longest", () => {
    const r = computeStreaks(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-08"], "2026-09-08");
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(3);
  });

  it("empty history = zeros", () => {
    expect(computeStreaks([], "2026-09-08")).toEqual({ currentStreak: 0, longestStreak: 0 });
  });
});
