import { describe, it, expect } from "vitest";
import {
  ACTIVITY_WEIGHTS,
  LEVEL_RANGES,
  WEEKS,
  buildConsistencyGrid,
  cellLabel,
  consistencyRange,
  countByDay,
  formatCellDate,
  levelForCount,
} from "./consistencyMap";

// Fixed Friday 2026-09-11 (local) — window starts Mon 2026-06-22.
const TODAY = new Date(2026, 8, 11, 18, 0, 0);
const MON = "2026-06-22"; // window start (Monday)
const FRI = "2026-09-11"; // today

describe("consistencyRange", () => {
  it("starts on the Monday 11 weeks back and ends today", () => {
    const r = consistencyRange(TODAY);
    expect(r.startKey).toBe(MON);
    expect(r.todayKey).toBe(FRI);
  });

  it("Monday today → this week's Monday is the last column start", () => {
    const r = consistencyRange(new Date(2026, 8, 7));
    expect(r.startKey).toBe("2026-06-22");
    expect(r.todayKey).toBe("2026-09-07");
  });
});

describe("countByDay / weights", () => {
  it("applies the documented weights per source", () => {
    const m = countByDay({
      sessionDates: ["2026-09-01"],
      planDates: ["2026-09-01", "2026-09-01"],
      habitDates: ["2026-09-01", "2026-09-02"],
      checkinDates: ["2026-09-03"],
    });
    expect(m.get("2026-09-01")).toBe(2 + 1 + 1 + 1); // session + 2 plans + 1 habit
    expect(m.get("2026-09-02")).toBe(ACTIVITY_WEIGHTS.habit);
    expect(m.get("2026-09-03")).toBe(ACTIVITY_WEIGHTS.checkin);
  });
});

describe("levelForCount", () => {
  it("buckets into the 5 documented levels", () => {
    expect(levelForCount(0)).toBe(0);
    expect(levelForCount(1)).toBe(1);
    expect(levelForCount(2)).toBe(1);
    expect(levelForCount(3)).toBe(2);
    expect(levelForCount(4)).toBe(2);
    expect(levelForCount(5)).toBe(3);
    expect(levelForCount(6)).toBe(3);
    expect(levelForCount(7)).toBe(4);
    expect(levelForCount(22)).toBe(4);
  });
});

describe("labels", () => {
  it("formats the tap/aria label honestly", () => {
    expect(formatCellDate("2026-09-09")).toBe("Wed 9 Sep");
    expect(cellLabel("2026-09-09", 0)).toBe("Wed 9 Sep — no activities");
    expect(cellLabel("2026-09-09", 1)).toBe("Wed 9 Sep — 1 activity");
    expect(cellLabel("2026-09-09", 2)).toBe("Wed 9 Sep — 2 activities");
    expect(LEVEL_RANGES).toEqual(["0", "1–2", "3–4", "5–6", "7+"]);
  });
});

describe("buildConsistencyGrid", () => {
  it("empty input → all-empty grid, zero active days, honest", () => {
    const g = buildConsistencyGrid({ sessionDates: [], planDates: [], habitDates: [], checkinDates: [], today: TODAY });
    expect(g.columns).toHaveLength(WEEKS);
    expect(g.columns.every((c) => c.length === 7)).toBe(true);
    expect(g.totalActiveDays).toBe(0);
    expect(g.maxCount).toBe(0);
    const flat = g.columns.flat();
    expect(flat.every((c) => c.level === 0 && c.count === 0)).toBe(true);
  });

  it("single-day activity lands on the right cell with the right level", () => {
    const g = buildConsistencyGrid({ sessionDates: [], planDates: [], habitDates: ["2026-09-09"], checkinDates: [], today: TODAY });
    const flat = g.columns.flat();
    const cell = flat.find((c) => c.dateKey === "2026-09-09");
    expect(cell).toBeDefined();
    expect(cell?.count).toBe(1);
    expect(cell?.level).toBe(1);
    expect(cell?.label).toBe("Wed 9 Sep — 1 activity");
    expect(g.totalActiveDays).toBe(1);
    // every other day is honest empty
    expect(flat.filter((c) => c.dateKey && c.dateKey !== "2026-09-09").every((c) => c.level === 0)).toBe(true);
  });

  it("mixed sources accumulate into intensity levels (3+ distinct)", () => {
    const g = buildConsistencyGrid({
      sessionDates: ["2026-09-07"],                          // Mon: 2
      planDates: ["2026-09-07", "2026-09-08", "2026-09-08"], // Mon +1, Tue +2
      habitDates: ["2026-09-07", "2026-09-08", "2026-09-09"],
      checkinDates: ["2026-09-07", "2026-09-10"],            // Mon +2, Thu: 2
      today: TODAY,
    });
    const byKey = new Map(g.columns.flat().map((c) => [c.dateKey, c]));
    expect(byKey.get("2026-09-07")?.count).toBe(2 + 1 + 1 + 2); // session+plan+habit+checkin = 6 → level 3
    expect(byKey.get("2026-09-07")?.level).toBe(3);
    expect(byKey.get("2026-09-08")?.count).toBe(2 + 1);         // 2 plans + habit = 3 → level 2
    expect(byKey.get("2026-09-08")?.level).toBe(2);
    expect(byKey.get("2026-09-09")?.level).toBe(1);
    expect(byKey.get("2026-09-10")?.level).toBe(1);
    const levels = new Set(g.columns.flat().map((c) => c.level));
    expect(levels.size).toBeGreaterThanOrEqual(3);
    expect(g.totalActiveDays).toBe(4);
    expect(g.maxCount).toBe(6);
  });

  it("marks today and pads only the days after today", () => {
    const g = buildConsistencyGrid({ sessionDates: [], planDates: [], habitDates: [], checkinDates: [], today: TODAY });
    const flat = g.columns.flat();
    const todayCell = flat.find((c) => c.isToday);
    expect(todayCell?.dateKey).toBe(FRI);
    const pads = flat.filter((c) => c.dateKey === null);
    // Fri today → Sat/Sun of the final column are pads: exactly 2
    expect(pads).toHaveLength(2);
    expect(pads.every((p) => p.label === "" && p.level === 0)).toBe(true);
    // window starts Monday → no leading pads
    expect(g.columns[0][0].dateKey).toBe(MON);
  });

  it("month labels appear when the month changes between columns", () => {
    const g = buildConsistencyGrid({ sessionDates: [], planDates: [], habitDates: [], checkinDates: [], today: TODAY });
    expect(g.monthLabels[0]).toBe("Jun"); // first column always labelled
    expect(g.monthLabels.some((l) => l === "Sep")).toBe(true);
    // no two consecutive equal labels (null = same as previous)
    for (let i = 1; i < g.monthLabels.length; i++) {
      if (g.monthLabels[i] !== null) {
        expect(g.monthLabels[i]).not.toBe(g.monthLabels[i - 1]);
      }
    }
  });

  it("ignores activity outside the 12-week window", () => {
    const g = buildConsistencyGrid({
      sessionDates: ["2026-06-20"], // Saturday BEFORE the Monday start
      habitDates: ["2026-09-12"],   // after today
      planDates: [],
      checkinDates: [],
      today: TODAY,
    });
    expect(g.totalActiveDays).toBe(0);
    expect(g.maxCount).toBe(0);
  });
});
