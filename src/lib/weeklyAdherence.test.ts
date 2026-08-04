import { describe, it, expect } from "vitest";
import {
  last7Dates,
  aggregateWeek,
  targetPercents,
  type AdherenceLogRow,
} from "@/lib/weeklyAdherence";

const row = (
  logged_date: string,
  quantity_g: number,
  calories: number,
  protein: number,
  serving_size_g: number | null = 100,
): AdherenceLogRow => ({ logged_date, quantity_g, calories, protein, serving_size_g });

describe("last7Dates (Phase 38)", () => {
  it("returns 7 dates ending today, oldest first", () => {
    const dates = last7Dates("2026-08-04");
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-07-29");
    expect(dates[6]).toBe("2026-08-04");
  });

  it("spans month boundaries correctly", () => {
    const dates = last7Dates("2026-08-02");
    expect(dates[0]).toBe("2026-07-27");
    expect(dates[5]).toBe("2026-08-01");
  });
});

describe("aggregateWeek (Phase 38)", () => {
  it("empty week: all 7 days present, zero logged, null averages", () => {
    const w = aggregateWeek([], "2026-08-04");
    expect(w.days).toHaveLength(7);
    expect(w.daysLogged).toBe(0);
    expect(w.avgKcal).toBeNull();
    expect(w.avgProtein).toBeNull();
    expect(w.days.every((d) => d.kcal === 0)).toBe(true);
  });

  it("partial week: averages over logged days only", () => {
    const rows = [
      row("2026-08-03", 100, 500, 40), // 500 kcal, 40g
      row("2026-08-03", 50, 500, 40), // 250 kcal, 20g → day: 750/60
      row("2026-08-04", 200, 400, 25), // 800 kcal, 50g
    ];
    const w = aggregateWeek(rows, "2026-08-04");
    expect(w.daysLogged).toBe(2);
    expect(w.days.find((d) => d.date === "2026-08-03")).toEqual({
      date: "2026-08-03",
      kcal: 750,
      protein: 60,
    });
    expect(w.avgKcal).toBe(Math.round((750 + 800) / 2)); // 775, not /7
    expect(w.avgProtein).toBe(55);
  });

  it("falls back to a 100g serving when serving_size_g is null", () => {
    const w = aggregateWeek([row("2026-08-04", 150, 200, 10, null)], "2026-08-04");
    expect(w.days[6].kcal).toBe(300);
  });

  it("ignores rows outside the 7-day window", () => {
    const w = aggregateWeek(
      [row("2026-07-20", 100, 999, 99), row("2026-07-29", 100, 100, 10)],
      "2026-08-04",
    );
    expect(w.daysLogged).toBe(1);
    expect(w.avgKcal).toBe(100);
  });
});

describe("targetPercents (Phase 38)", () => {
  const week = aggregateWeek(
    [row("2026-08-04", 100, 1370, 103)],
    "2026-08-04",
  );

  it("null when targets are missing (honest 'Set targets first' state)", () => {
    expect(targetPercents(week, null)).toBeNull();
    expect(targetPercents(aggregateWeek([], "2026-08-04"), { calories: 2740, protein: 206 })).toBeNull();
  });

  it("rounds average-vs-target percentages", () => {
    expect(targetPercents(week, { calories: 2740, protein: 206 })).toEqual({
      kcalPct: 50,
      proteinPct: 50,
    });
  });
});
