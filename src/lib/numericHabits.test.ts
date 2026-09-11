import { describe, it, expect } from "vitest";
import {
  findNumericHabit,
  weekValues,
  averageLogged,
  numericPct,
  formatNumeric,
  numericValueLine,
  sliderSpecForTarget,
  aggregateNumericWeek,
  type NumericHabitLike,
  type NumericLogLike,
} from "./numericHabits";

const sleepHabit: NumericHabitLike = {
  id: "h-sleep",
  name: "Sleep",
  active: true,
  target_value: 8,
  unit: "h",
};

const waterHabit: NumericHabitLike = {
  id: "h-water",
  name: "Water",
  active: true,
  target_value: 3,
  unit: "L",
};

const flagHabit: NumericHabitLike = {
  id: "h-flag",
  name: "Read 10 pages",
  active: true,
  target_value: null,
  unit: null,
};

describe("findNumericHabit", () => {
  it("matches by keyword and requires a numeric target", () => {
    expect(findNumericHabit([sleepHabit, waterHabit], "sleep")?.id).toBe("h-sleep");
    expect(findNumericHabit([waterHabit], "water")?.id).toBe("h-water");
  });

  it("skips flag-only habits and inactive ones", () => {
    expect(findNumericHabit([flagHabit], "sleep")).toBeNull();
    expect(findNumericHabit([{ ...sleepHabit, active: false }], "sleep")).toBeNull();
  });

  it("matches keyword inside a longer name", () => {
    expect(findNumericHabit([{ ...sleepHabit, name: "Sleep 8 hours" }], "sleep")?.id).toBe("h-sleep");
    expect(findNumericHabit([{ ...waterHabit, name: "Hydration" }], "water")?.id).toBe("h-water");
  });
});

describe("weekValues", () => {
  const logs: NumericLogLike[] = [
    { habit_id: "h-sleep", log_date: "2026-02-16", done: true, value: 7 }, // Mon
    { habit_id: "h-sleep", log_date: "2026-02-17", done: true, value: 8 }, // Tue
    { habit_id: "h-sleep", log_date: "2026-02-18", done: false, value: 6 }, // Wed undone
    { habit_id: "h-sleep", log_date: "2026-02-19", done: true, value: null }, // Thu NULL value
  ];

  it("maps each Mon..today day; unlogged/undone/NULL are null", () => {
    const values = weekValues(logs, "h-sleep", "2026-02-16", "2026-02-20");
    expect(values).toEqual([7, 8, null, null, null]);
  });

  it("ignores rows for other habits", () => {
    const values = weekValues(
      [...logs, { habit_id: "h-water", log_date: "2026-02-16", done: true, value: 2 }],
      "h-sleep",
      "2026-02-16",
      "2026-02-16",
    );
    expect(values).toEqual([7]);
  });
});

describe("averageLogged", () => {
  it("averages only logged days — missing days are NOT zero-filled", () => {
    expect(averageLogged([7.5, null, 8, null])).toBe(7.75);
  });

  it("returns null when nothing logged", () => {
    expect(averageLogged([null, null])).toBeNull();
    expect(averageLogged([])).toBeNull();
  });
});

describe("numericPct", () => {
  it("avg ÷ target × 100, rounded", () => {
    expect(numericPct(7.5, 8)).toBe(94);
    expect(numericPct(1.8, 3)).toBe(60);
  });

  it("caps at 100 for above-target averages", () => {
    expect(numericPct(9, 8)).toBe(100);
  });

  it("zero/negative target is 0, never NaN", () => {
    expect(numericPct(5, 0)).toBe(0);
  });
});

describe("formatNumeric / numericValueLine", () => {
  it("trims trailing zeros", () => {
    expect(formatNumeric(7.5)).toBe("7.5");
    expect(formatNumeric(8)).toBe("8");
    expect(formatNumeric(1.8)).toBe("1.8");
    expect(formatNumeric(2.5)).toBe("2.5");
  });

  it("builds the honest value line", () => {
    expect(numericValueLine(7.5, 8, "h")).toBe("7.5 of 8 h");
    expect(numericValueLine(1.8, 3, "L")).toBe("1.8 of 3 L");
  });
});

describe("sliderSpecForTarget", () => {
  it("sleep target 8: 0..16, 0.5 step (7.5 reachable)", () => {
    expect(sliderSpecForTarget(8)).toEqual({ min: 0, max: 16, step: 0.5 });
  });

  it("water target 3: 0..6, 0.1 step (1.8 reachable)", () => {
    expect(sliderSpecForTarget(3)).toEqual({ min: 0, max: 6, step: 0.1 });
  });

  it("steps target 10000: step 1, generous max", () => {
    const spec = sliderSpecForTarget(10000);
    expect(spec.step).toBe(1);
    expect(spec.max).toBe(20000);
  });
});

describe("aggregateNumericWeek", () => {
  it("returns null for a flag-only habit", () => {
    expect(aggregateNumericWeek(flagHabit, [], "2026-02-16", "2026-02-20")).toBeNull();
  });

  it("aggregates logged days vs the habit's own target", () => {
    const logs: NumericLogLike[] = [
      { habit_id: "h-sleep", log_date: "2026-02-16", done: true, value: 7 },
      { habit_id: "h-sleep", log_date: "2026-02-17", done: true, value: 8 },
    ];
    const agg = aggregateNumericWeek(sleepHabit, logs, "2026-02-16", "2026-02-20");
    expect(agg).not.toBeNull();
    expect(agg?.loggedDays).toBe(2);
    expect(agg?.avg).toBe(7.5);
    expect(agg?.target).toBe(8);
    expect(agg?.unit).toBe("h");
  });

  it("avg is null when no logs this week (honest empty state)", () => {
    const agg = aggregateNumericWeek(waterHabit, [], "2026-02-16", "2026-02-20");
    expect(agg?.avg).toBeNull();
    expect(agg?.loggedDays).toBe(0);
  });
});
