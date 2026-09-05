import { describe, it, expect } from "vitest";
import { monthCells, monthTitle, addMonths } from "./monthCalendar";

const TODAY = new Date(2026, 8, 2, 15, 0); // Wed 2 Sep 2026 local

describe("monthCalendar (Phase 68 Item 2)", () => {
  it("yields 42 Monday-start cells covering the month", () => {
    const cells = monthCells(2026, 8, TODAY); // September 2026
    expect(cells).toHaveLength(42);
    expect(cells[0].date.getDay()).toBe(1); // Monday
    expect(cells[0].dateKey).toBe("2026-08-31"); // spill from August
    expect(cells[41].date.getDay()).toBe(0); // Sunday
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30); // September has 30 days
  });

  it("marks today by local date key; inMonth for the 1st and last", () => {
    const cells = monthCells(2026, 8, TODAY);
    const today = cells.find((c) => c.isToday);
    expect(today?.dateKey).toBe("2026-09-02");
    expect(cells.find((c) => c.dateKey === "2026-09-01")?.inMonth).toBe(true);
    expect(cells.find((c) => c.dateKey === "2026-08-31")?.inMonth).toBe(false);
  });

  it("handles year boundaries in addMonths", () => {
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
  });

  it("monthTitle is en-US pinned", () => {
    expect(monthTitle(2026, 8)).toBe("September 2026");
  });
});
