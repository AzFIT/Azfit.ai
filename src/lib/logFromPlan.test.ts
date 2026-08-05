import { describe, it, expect } from "vitest";
import { planDayForWeekday } from "@/lib/logFromPlan";

describe("planDayForWeekday (Phase 43)", () => {
  it("Mon=1 … Sun=7 for a 7-day plan", () => {
    expect(planDayForWeekday(1, 7)).toBe(1);
    expect(planDayForWeekday(3, 7)).toBe(3);
    expect(planDayForWeekday(7, 7)).toBe(7);
  });

  it("wraps modulo the plan length for shorter plans", () => {
    // 5-day plan: Mon-Fri → 1-5, Sat → 1, Sun → 2
    expect(planDayForWeekday(5, 5)).toBe(5);
    expect(planDayForWeekday(6, 5)).toBe(1);
    expect(planDayForWeekday(7, 5)).toBe(2);
    // 3-day plan: Thu → 1 (4 mod 3), Fri → 2, Sat → 3, Sun → 1
    expect(planDayForWeekday(4, 3)).toBe(1);
    expect(planDayForWeekday(5, 3)).toBe(2);
    expect(planDayForWeekday(6, 3)).toBe(3);
    expect(planDayForWeekday(7, 3)).toBe(1);
  });

  it("1-day plan maps every weekday to day 1", () => {
    for (let wd = 1; wd <= 7; wd++) {
      expect(planDayForWeekday(wd, 1)).toBe(1);
    }
  });

  it("clamps out-of-range inputs defensively", () => {
    expect(planDayForWeekday(0, 5)).toBe(1);
    expect(planDayForWeekday(9, 5)).toBe(2);
    expect(planDayForWeekday(3, 0)).toBe(1);
  });
});
