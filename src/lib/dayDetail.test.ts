/* Phase 90c — unit tests for the pure month-calendar derivation.
   Fixtures use fixed local date keys (no "today" assumptions). */

import { describe, it, expect } from "vitest";
import {
  buildMonthGrid,
  compareKeys,
  monthNavBounds,
  shiftMonth,
  streakCaption,
  formatHabitValue,
} from "./dayDetail";

const TODAY = "2026-09-12"; // a Saturday
const WINDOW_START = "2026-06-15"; // a Monday (12 weeks back)

function countsOf(entries: Record<string, number>) {
  return new Map(Object.entries(entries));
}

describe("compareKeys", () => {
  it("orders zero-padded local date keys lexicographically", () => {
    expect(compareKeys("2026-09-01", "2026-09-02")).toBe(-1);
    expect(compareKeys("2026-09-02", "2026-09-02")).toBe(0);
    expect(compareKeys("2026-10-01", "2026-09-30")).toBe(1);
  });
});

describe("buildMonthGrid", () => {
  it("pads leading cells so the 1st lands on its weekday (Mon-start)", () => {
    // September 2026 starts on a Tuesday → 1 leading pad (Monday).
    const { weeks } = buildMonthGrid(2026, 8, {
      todayKey: TODAY,
      counts: countsOf({}),
      windowStartKey: WINDOW_START,
    });
    expect(weeks[0][0].dateKey).toBeNull(); // Monday pad
    expect(weeks[0][1].dateKey).toBe("2026-09-01"); // Tuesday 1st
    expect(weeks).toHaveLength(5); // Sep 2026 spans exactly 5 weeks
  });

  it("marks today with the outline flag and real counts with levels", () => {
    // 2 activities on the 10th (level 1: 1–2 pts), 5 on the 11th (level 3).
    const { weeks } = buildMonthGrid(2026, 8, {
      todayKey: TODAY,
      counts: countsOf({ "2026-09-10": 2, "2026-09-11": 5 }),
      windowStartKey: WINDOW_START,
    });
    const flat = weeks.flat();
    const d10 = flat.find((c) => c.dateKey === "2026-09-10")!;
    const d11 = flat.find((c) => c.dateKey === "2026-09-11")!;
    const d12 = flat.find((c) => c.dateKey === "2026-09-12")!;
    expect(d10.count).toBe(2);
    expect(d10.level).toBe(1);
    expect(d11.count).toBe(5);
    expect(d11.level).toBe(3);
    expect(d12.isToday).toBe(true);
    expect(d12.count).toBe(0);
    // A stronger day outranks a weaker one (intensity mapping preserved).
    expect(d11.level).toBeGreaterThan(d10.level);
  });

  it("flags future days and pre-window days honestly", () => {
    const { weeks } = buildMonthGrid(2026, 8, {
      todayKey: TODAY,
      counts: countsOf({}),
      windowStartKey: WINDOW_START,
    });
    const flat = weeks.flat();
    const future = flat.find((c) => c.dateKey === "2026-09-20")!;
    expect(future.future).toBe(true);
    const past = flat.find((c) => c.dateKey === "2026-09-05")!;
    expect(past.future).toBe(false);
    expect(past.beforeWindow).toBe(false);
  });

  it("marks days before the window start (engine holds no counts)", () => {
    // June 2026: window starts Mon 15th — the 10th is before it.
    const { weeks } = buildMonthGrid(2026, 5, {
      todayKey: TODAY,
      counts: countsOf({}),
      windowStartKey: WINDOW_START,
    });
    const flat = weeks.flat();
    expect(flat.find((c) => c.dateKey === "2026-06-10")!.beforeWindow).toBe(true);
    expect(flat.find((c) => c.dateKey === "2026-06-16")!.beforeWindow).toBe(false);
  });

  it("pads trailing cells to complete the final week and labels every day", () => {
    const { weeks } = buildMonthGrid(2026, 8, {
      todayKey: TODAY,
      counts: countsOf({}),
      windowStartKey: WINDOW_START,
    });
    const flat = weeks.flat();
    expect(flat.length % 7).toBe(0);
    for (const c of flat) {
      if (c.dateKey === null) {
        expect(c.label).toBe("");
        expect(c.count).toBe(0);
      } else {
        expect(c.label).toMatch(/^(\w{3}) \d+ (\w{3}) — (no|\d+) (activity|activities)$/);
      }
    }
  });

  it("renders a real month title", () => {
    const { title } = buildMonthGrid(2026, 8, {
      todayKey: TODAY,
      counts: countsOf({}),
      windowStartKey: WINDOW_START,
    });
    expect(title).toBe("September 2026");
  });
});

describe("monthNavBounds", () => {
  it("blocks prev when the previous month ends before the window", () => {
    // Displayed June 2026: May 31 < window start June 15 → no prev.
    expect(monthNavBounds(2026, 5, WINDOW_START, TODAY).canPrev).toBe(false);
    // Displayed July 2026: June 30 >= June 15 → prev allowed.
    expect(monthNavBounds(2026, 6, WINDOW_START, TODAY).canPrev).toBe(true);
  });

  it("blocks next on the current month, allows earlier months", () => {
    expect(monthNavBounds(2026, 8, WINDOW_START, TODAY).canNext).toBe(false); // September
    expect(monthNavBounds(2026, 7, WINDOW_START, TODAY).canNext).toBe(true); // August
  });

  it("allows exactly the window edge month", () => {
    // Displayed June (prev → May blocked); prev INTO June allowed.
    const june = monthNavBounds(2026, 5, WINDOW_START, TODAY);
    expect(june.canPrev).toBe(false);
    expect(june.canNext).toBe(true);
  });
});

describe("shiftMonth", () => {
  it("crosses year boundaries in both directions", () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 8, -1)).toEqual({ year: 2026, month: 7 });
  });
});

describe("streakCaption", () => {
  it("returns null below 2 days (never a 1-day streak claim)", () => {
    expect(streakCaption(0)).toBeNull();
    expect(streakCaption(1)).toBeNull();
  });
  it("states the real streak number", () => {
    expect(streakCaption(10)).toBe("You're on a 10-day streak");
    expect(streakCaption(2)).toBe("You're on a 2-day streak");
  });
});

describe("formatHabitValue", () => {
  it("trims trailing zeros and appends the unit", () => {
    expect(formatHabitValue(7.5, "h")).toBe("7.5 h");
    expect(formatHabitValue(8, "h")).toBe("8 h");
    expect(formatHabitValue(1.8, "L")).toBe("1.8 L");
  });
  it("separates thousands for large step counts", () => {
    expect(formatHabitValue(8432, "steps")).toBe("8,432 steps");
  });
  it("a bare done flag formats as Done — never a fake zero", () => {
    expect(formatHabitValue(null, "h")).toBe("Done");
  });
  it("unitless values render bare", () => {
    expect(formatHabitValue(3, null)).toBe("3");
  });
});
