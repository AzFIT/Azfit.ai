import { describe, it, expect } from "vitest";
import { computeMetricTiles, elapsedDaysThisWeek, weekStartMonday } from "./metricTiles";

const BASE = {
  sessionsScheduled: 3,
  sessionsCompleted: 2,
  elapsedDays: 5,
  sleepTargetSet: true,
  waterTargetSet: true,
  sleepDoneDays: 3,
  waterDoneDays: 4,
  checkinSubmitted: true,
};

describe("computeMetricTiles", () => {
  it("activity: completed ÷ scheduled, capped at 100", () => {
    const [a] = computeMetricTiles(BASE);
    expect(a.pct).toBe(67);
    expect(a.value).toBe("2 of 3 sessions");
    expect(a.state).toBe("ready");
    const [aCap] = computeMetricTiles({ ...BASE, sessionsScheduled: 2, sessionsCompleted: 5 });
    expect(aCap.pct).toBe(100); // capped
  });

  it("activity: zero scheduled = honest empty (no % shown)", () => {
    const [a] = computeMetricTiles({ ...BASE, sessionsScheduled: 0, sessionsCompleted: 0 });
    expect(a.pct).toBeNull();
    expect(a.value).toBe("No sessions this week");
    expect(a.state).toBe("no_logs");
  });

  it("sleep: done days ÷ elapsed days", () => {
    const [, s] = computeMetricTiles(BASE);
    expect(s.pct).toBe(60); // 3/5
    expect(s.value).toBe("3 of 5 nights");
  });

  it("sleep: unset target = Set a target (no ring %)", () => {
    const [, s] = computeMetricTiles({ ...BASE, sleepTargetSet: false });
    expect(s.pct).toBeNull();
    expect(s.value).toBe("Set a target");
    expect(s.state).toBe("no_target");
  });

  it("sleep: target set but zero logs = honest 0% No logs yet", () => {
    const [, s] = computeMetricTiles({ ...BASE, sleepDoneDays: 0 });
    expect(s.pct).toBe(0);
    expect(s.value).toBe("No logs yet");
    expect(s.state).toBe("no_logs");
  });

  it("hydration: mirrors the sleep rules", () => {
    const [, , h] = computeMetricTiles(BASE);
    expect(h.pct).toBe(80); // 4/5
    expect(h.value).toBe("4 of 5 days");
    const [, , hNoTarget] = computeMetricTiles({ ...BASE, waterTargetSet: false });
    expect(hNoTarget.value).toBe("Set a target");
    const [, , hNoLogs] = computeMetricTiles({ ...BASE, waterDoneDays: 0 });
    expect(hNoLogs.pct).toBe(0);
    expect(hNoLogs.value).toBe("No logs yet");
  });

  it("check-ins: Done vs Due this week", () => {
    const [, , , c1] = computeMetricTiles(BASE);
    expect(c1.pct).toBe(100);
    expect(c1.value).toBe("Done");
    const [, , , c2] = computeMetricTiles({ ...BASE, checkinSubmitted: false });
    expect(c2.pct).toBe(0);
    expect(c2.value).toBe("Due this week");
    expect(c2.hint).toBe("Tap to check in");
  });

  it("singular nouns render correctly", () => {
    const [a] = computeMetricTiles({ ...BASE, sessionsScheduled: 1, sessionsCompleted: 1 });
    expect(a.value).toBe("1 of 1 session");
    const [, s] = computeMetricTiles({ ...BASE, elapsedDays: 1, sleepDoneDays: 1 });
    expect(s.value).toBe("1 of 1 night");
  });
});

describe("week helpers", () => {
  it("weekStartMonday returns Monday for any weekday", () => {
    // Wed 2026-09-09 → Mon 2026-09-07
    expect(weekStartMonday(new Date(2026, 8, 9)).getDate()).toBe(7);
    // Sun 2026-09-13 → same Monday
    expect(weekStartMonday(new Date(2026, 8, 13)).getDate()).toBe(7);
    // Mon itself
    expect(weekStartMonday(new Date(2026, 8, 7)).getDate()).toBe(7);
  });

  it("elapsedDaysThisWeek counts Mon..today", () => {
    expect(elapsedDaysThisWeek(new Date(2026, 8, 7))).toBe(1); // Mon
    expect(elapsedDaysThisWeek(new Date(2026, 8, 9))).toBe(3); // Wed
    expect(elapsedDaysThisWeek(new Date(2026, 8, 13))).toBe(7); // Sun
  });
});
