import { describe, it, expect } from "vitest";
import {
  habitSignalsForTargets,
  buildTodayPlan,
  planCompletion,
  shouldCelebrate,
  celebrationDismissed,
  dismissCelebration,
  rangeDateKeys,
  summarizeRange,
  weeklyBars,
  rangeLabel,
  type PlanItem,
} from "./dailyPlan";

const row = (id: string, label: string, done = false, sort = 0) => ({
  id,
  client_id: "c1",
  plan_date: "2026-09-02",
  label,
  source: "custom",
  done,
  sort_order: sort,
});

describe("habitSignalsForTargets — keyword match + today's logs", () => {
  const habits = [
    { id: "h1", name: "Drink 2L water", is_active: true },
    { id: "h2", name: "10k steps daily", is_active: true },
    { id: "h3", name: "Evening reading", is_active: true },
    { id: "h4", name: "Sleep by 22:30", is_active: false }, // inactive never counts
  ];

  it("maps water/steps/sleep habits and their done state", () => {
    const s = habitSignalsForTargets(habits, [{ habit_id: "h1", done: true }]);
    expect(s.water).toEqual({ available: true, done: true });
    expect(s.steps).toEqual({ available: true, done: false });
    expect(s.sleep).toEqual({ available: false, done: false }); // h4 inactive
  });

  it("no habits → everything unavailable (untrackable, never faked)", () => {
    const s = habitSignalsForTargets([], []);
    expect(s.water.available).toBe(false);
    expect(s.water.done).toBe(false);
  });
});

describe("buildTodayPlan — customs + derived autos", () => {
  it("customs first (sorted), then session/targets/check-in", () => {
    const items = buildTodayPlan({
      customRows: [row("b", "Second", false, 1), row("a", "First", true, 0)],
      sessionTitle: "Alex Carter PT",
      sessionDone: true,
      targets: { water_ml: 3000, steps: 8000 },
      targetSignals: {
        water: { available: true, done: true },
        steps: { available: false, done: false },
        sleep: { available: false, done: false },
      },
      checkinDue: true,
      checkinDone: false,
    });
    expect(items.map((i) => i.label)).toEqual([
      "First",
      "Second",
      "Workout: Alex Carter PT",
      "Drink 3,000 ml water",
      "8,000 steps",
      "Complete weekly check-in",
    ]);
    expect(items[2]).toMatchObject({ done: true, auto: true, trackable: true }); // session done derived
    expect(items[3]).toMatchObject({ done: true, trackable: true }); // habit logged
    expect(items[4]).toMatchObject({ done: false, trackable: false }); // no signal — never faked
    expect(items[5]).toMatchObject({ done: false, auto: true });
  });

  it("omits absent sources and zero targets entirely", () => {
    const items = buildTodayPlan({ customRows: [], targets: { water_ml: 0, steps: null } });
    expect(items).toEqual([]);
  });
});

describe("planCompletion + the >5-items celebration rule", () => {
  const mk = (n: number, done: number): PlanItem[] =>
    Array.from({ length: n }, (_, i) => ({
      key: `k${i}`,
      label: `Item ${i}`,
      source: "custom" as const,
      done: i < done,
      auto: false,
      trackable: true,
    }));

  it("computes honest percentages", () => {
    expect(planCompletion([])).toEqual({ done: 0, total: 0, pct: 0 });
    expect(planCompletion(mk(4, 3))).toEqual({ done: 3, total: 4, pct: 75 });
  });

  it("celebrates only at 100% with MORE than 5 items, once per day", () => {
    expect(shouldCelebrate(mk(6, 6), false)).toBe(true);
    expect(shouldCelebrate(mk(5, 5), false)).toBe(false); // exactly 5 → suppressed
    expect(shouldCelebrate(mk(6, 5), false)).toBe(false); // not 100%
    expect(shouldCelebrate(mk(6, 6), true)).toBe(false); // dismissed already
  });

  it("dismissal persists per day key", () => {
    expect(celebrationDismissed("2026-09-02")).toBe(false);
    dismissCelebration("2026-09-02");
    expect(celebrationDismissed("2026-09-02")).toBe(true);
    expect(celebrationDismissed("2026-09-03")).toBe(false); // new day fires again
  });
});

describe("tracking ranges (Daily / Weekly / Monthly / Yearly)", () => {
  const now = new Date(2026, 8, 2, 15, 0); // Wed 2 Sep 2026 15:00 local

  it("daily = today only; weekly = Monday→today; never future days", () => {
    expect(rangeDateKeys("daily", now)).toEqual(["2026-09-02"]);
    const week = rangeDateKeys("weekly", now);
    expect(week).toEqual(["2026-08-31", "2026-09-01", "2026-09-02"]);
    const month = rangeDateKeys("monthly", now);
    expect(month[0]).toBe("2026-09-01");
    expect(month[month.length - 1]).toBe("2026-09-02");
    const year = rangeDateKeys("yearly", now);
    expect(year[0]).toBe("2026-01-01");
    expect(year[year.length - 1]).toBe("2026-09-02");
  });

  it("summarizeRange counts only days with items; pct null when empty", () => {
    const s = summarizeRange([
      { dateKey: "2026-08-31", done: 3, total: 5 },
      { dateKey: "2026-09-01", done: 0, total: 0 }, // nothing planned — excluded
      { dateKey: "2026-09-02", done: 4, total: 5 },
    ]);
    expect(s).toEqual({ done: 7, total: 10, pct: 70, daysWithItems: 2, dayCount: 3 });
    expect(summarizeRange([{ dateKey: "d", done: 0, total: 0 }]).pct).toBeNull();
  });

  it("weeklyBars gives per-day pct with null for empty days", () => {
    expect(
      weeklyBars([
        { dateKey: "a", done: 2, total: 4 },
        { dateKey: "b", done: 0, total: 0 },
      ]),
    ).toEqual([50, null]);
  });

  it("rangeLabel is honest about empty ranges", () => {
    expect(rangeLabel("weekly", { done: 34, total: 50, pct: 68, daysWithItems: 5, dayCount: 7 })).toBe(
      "This week: 68% of plans completed (34/50)",
    );
    expect(rangeLabel("yearly", { done: 0, total: 0, pct: null, daysWithItems: 0, dayCount: 245 })).toBe(
      "This year: no plans yet",
    );
  });
});
