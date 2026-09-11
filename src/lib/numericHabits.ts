/* ═══════════════════════════════════════════════════════════════
   numericHabits (Phase 85) — pure derivation for numeric habit
   logging: habits with habits.target_value + unit, logged via
   habit_logs.value (done-flag habits are untouched).

   FORMULA (visible by rule — every number traces to these):
   · weekValues(): this week's (Mon–today) per-day values for one
     habit; a day with no row, an undone row, or a NULL value maps
     to null. Missing days are EXCLUDED from aggregation — a day
     with no log is never counted as 0 (honest-data rule).
   · averageLogged(): arithmetic mean of the non-null values;
     null when nothing was logged this week.
   · numericPct(): round(avg ÷ target × 100), capped at 100.
     A logged average ABOVE target shows a full ring (100%), never
     >100% — the value line still states the real numbers.
   · numericValueLine(): "<avg> of <target> <unit>", numbers
     trimmed of trailing zeros ("7.5 of 8 h", "1.8 of 3 L").
   · sliderSpecForTarget(): ArcSlider min/max/step derived from the
     habit's own target — max = max(2×target, target+1) so values
     above target stay reachable; step is fine enough to hit
     sub-unit values (0.1 below 5, 0.5 below 100, else 1).
   ═══════════════════════════════════════════════════════════════ */

import { TARGET_HABIT_KEYWORDS } from "@/lib/dailyPlan";

export interface NumericHabitLike {
  id: string;
  name: string;
  active?: boolean;
  target_value: number | null;
  unit: string | null;
}

export interface NumericLogLike {
  habit_id: string;
  log_date: string;
  done: boolean;
  value: number | null;
}

export type NumericTargetKey = "water" | "sleep";

/** First active numeric habit matching the target's keyword map
 *  (same keywords as dailyPlan's TargetSignal). Null = none. */
export function findNumericHabit(
  habits: NumericHabitLike[],
  key: NumericTargetKey,
): NumericHabitLike | null {
  const re = TARGET_HABIT_KEYWORDS[key];
  return habits.find((h) => h.active !== false && h.target_value != null && re.test(h.name)) ?? null;
}

/** Per-day values for this week (Mon..today), null for unlogged days. */
export function weekValues(
  logs: NumericLogLike[],
  habitId: string,
  weekStartKey: string,
  todayKey: string,
): (number | null)[] {
  const byDate = new Map<string, NumericLogLike>();
  for (const l of logs) {
    if (l.habit_id === habitId) byDate.set(l.log_date, l);
  }
  const out: (number | null)[] = [];
  const d = new Date(`${weekStartKey}T00:00:00`);
  const end = new Date(`${todayKey}T00:00:00`);
  while (d <= end) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const log = byDate.get(key);
    out.push(log && log.done && log.value != null ? log.value : null);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Mean of logged values; null when nothing logged (missing days excluded). */
export function averageLogged(values: (number | null)[]): number | null {
  const logged = values.filter((v): v is number => v != null);
  if (logged.length === 0) return null;
  return logged.reduce((a, b) => a + b, 0) / logged.length;
}

/** Ring percentage: avg ÷ target × 100, capped at 100. */
export function numericPct(avg: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((avg / target) * 100)));
}

/** "7.5 of 8 h" / "1.8 of 3 L" — trailing zeros trimmed. */
export function formatNumeric(n: number): string {
  return String(parseFloat(n.toFixed(2)));
}

export function numericValueLine(avg: number, target: number, unit: string): string {
  return `${formatNumeric(avg)} of ${formatNumeric(target)} ${unit}`.trim();
}

/** ArcSlider spec derived from the habit target (see formula header). */
export function sliderSpecForTarget(target: number): { min: number; max: number; step: number } {
  const max = Math.max(target * 2, target + 1);
  const step = target < 5 ? 0.1 : target < 100 ? 0.5 : 1;
  return { min: 0, max, step };
}

/** Compact aggregate for the metric tiles: avg of this week's logged
 *  values vs the habit's own target. Null avg = "No logs yet". */
export interface NumericWeekAggregate {
  habitId: string;
  target: number;
  unit: string;
  loggedDays: number;
  avg: number | null;
}

export function aggregateNumericWeek(
  habit: NumericHabitLike,
  logs: NumericLogLike[],
  weekStartKey: string,
  todayKey: string,
): NumericWeekAggregate | null {
  if (habit.target_value == null) return null;
  const values = weekValues(logs, habit.id, weekStartKey, todayKey);
  return {
    habitId: habit.id,
    target: habit.target_value,
    unit: habit.unit ?? "",
    loggedDays: values.filter((v) => v != null).length,
    avg: averageLogged(values),
  };
}
