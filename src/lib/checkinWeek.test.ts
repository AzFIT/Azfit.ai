import { describe, it, expect } from "vitest";
import {
  currentWeekStart,
  isInCurrentWeek,
  currentWeekLabel,
  overdueRank,
} from "@/lib/checkinWeek";

// Wednesday 2026-08-05 is this session's "today" — week starts Mon Aug 3
const NOW = new Date(2026, 7, 5, 15, 30); // local time

describe("currentWeekStart (Phase 44)", () => {
  it("returns Monday 00:00 local of the containing week", () => {
    const s = currentWeekStart(NOW);
    expect(s.getDay()).toBe(1); // Monday
    expect([s.getHours(), s.getMinutes(), s.getSeconds()]).toEqual([0, 0, 0]);
    expect(s.getDate()).toBe(3); // Aug 3
  });

  it("Monday itself is its own week start; Sunday belongs to the previous Monday", () => {
    expect(currentWeekStart(new Date(2026, 7, 3, 9)).getDate()).toBe(3); // Mon Aug 3
    expect(currentWeekStart(new Date(2026, 7, 9, 23)).getDate()).toBe(3); // Sun Aug 9 → Mon Aug 3
    expect(currentWeekStart(new Date(2026, 7, 10, 0)).getDate()).toBe(10); // next Mon
  });
});

describe("isInCurrentWeek (Phase 44)", () => {
  it("true for any time Mon 00:00 → Sun 23:59", () => {
    expect(isInCurrentWeek(new Date(2026, 7, 3, 0, 0, 1), NOW)).toBe(true);
    expect(isInCurrentWeek(new Date(2026, 7, 9, 23, 59), NOW)).toBe(true);
  });

  it("false outside the week (incl. ISO strings)", () => {
    expect(isInCurrentWeek(new Date(2026, 7, 2, 23, 59), NOW)).toBe(false);
    expect(isInCurrentWeek(new Date(2026, 7, 10, 0, 0), NOW)).toBe(false);
    expect(isInCurrentWeek("2026-08-04T12:00:00", NOW)).toBe(true);
    expect(isInCurrentWeek("2026-07-30T12:00:00", NOW)).toBe(false);
  });
});

describe("currentWeekLabel (Phase 44)", () => {
  it("formats the week's Monday", () => {
    expect(currentWeekLabel(NOW)).toBe("2026-08-03");
  });
});

describe("overdueRank — due-badge clearing (Phase 44)", () => {
  it("0 (not due) when a submission exists in the current week", () => {
    expect(overdueRank("2026-08-04T10:00:00", NOW)).toBe(0);
  });

  it("weeks-since when the last submission is older", () => {
    // last week → 1, three weeks ago → 3
    expect(overdueRank("2026-07-29T10:00:00", NOW)).toBe(1);
    expect(overdueRank("2026-07-15T10:00:00", NOW)).toBe(3);
  });

  it("Infinity when never submitted (most overdue)", () => {
    expect(overdueRank(null, NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it("a Saturday submission does NOT clear the following Monday (week boundary)", () => {
    // submitted Sat Aug 8; on Mon Aug 10 the new week is due again
    expect(overdueRank("2026-08-08T10:00:00", new Date(2026, 7, 10, 9))).toBe(1);
    // …but within the same week it clears
    expect(overdueRank("2026-08-08T10:00:00", new Date(2026, 7, 9, 9))).toBe(0);
  });
});
