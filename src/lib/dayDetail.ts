/* ═══════════════════════════════════════════════════════════════
   dayDetail (Phase 90c) — pure derivation for the compact month
   consistency calendar (the Phase 86 heatmap's right-sized default
   surface). The Phase 86 engine (consistencyMap.ts / useConsistencyMap)
   is REUSED UNCHANGED — this lib only shapes its per-day counts into
   a month grid and formats the day-sheet values.

   MONTH GRID: Monday-start, leading/trailing out-of-month cells are
   STRUCTURAL PADS (dateKey null, aria-hidden, never data). In-month
   day intensity reuses consistencyMap.levelForCount — the exact
   5-level Phase 86 weights, no new intensity math. Days before the
   12-week window carry counts of 0 (the engine only aggregates the
   window) and are flagged `beforeWindow` so the UI can be honest
   about why they show no accent.

   DATE KEYS: local YYYY-MM-DD (formatDateKeyLocal pattern) — never
   raw UTC.
   ═══════════════════════════════════════════════════════════════ */

import { cellLabel, levelForCount } from "./consistencyMap";

export interface MonthCell {
  /** null = structural pad (out-of-month); never data */
  dateKey: string | null;
  /** weighted Phase 86 point total (0 = no logged activity) */
  count: number;
  /** 0–4 via levelForCount — unchanged Phase 86 math */
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  /** dateKey < the 12-week window start (engine holds no counts) */
  beforeWindow: boolean;
  /** true dateKey > today (future day — sheet shows "nothing yet") */
  future: boolean;
  /** "Wed 3 Sep — 2 activities" / "— no activities" ("" for pads) */
  label: string;
}

export interface MonthGrid {
  /** 4–6 weeks, each Mon..Sun; out-of-month cells are pads */
  weeks: MonthCell[][];
  /** "September 2026" */
  title: string;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Compare two local date keys (lexicographic works for zero-padded keys). */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Build the Monday-start month grid for a local year/month (month 0-11). */
export function buildMonthGrid(
  year: number,
  month: number,
  opts: {
    todayKey: string;
    /** counts from the Phase 86 engine (countByDay of the raw sources) */
    counts: Map<string, number>;
    /** consistencyRange().startKey — counts only exist within the window */
    windowStartKey: string;
  },
): MonthGrid {
  const { todayKey, counts, windowStartKey } = opts;
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingPads = (first.getDay() + 6) % 7; // Mon=0..Sun=6

  const cells: MonthCell[] = [];
  for (let i = 0; i < leadingPads; i++) {
    cells.push({
      dateKey: null, count: 0, level: 0,
      isToday: false, beforeWindow: false, future: false, label: "",
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(new Date(year, month, d));
    const count = counts.get(key) ?? 0;
    cells.push({
      dateKey: key,
      count,
      level: levelForCount(count),
      isToday: key === todayKey,
      beforeWindow: compareKeys(key, windowStartKey) < 0,
      future: compareKeys(key, todayKey) > 0,
      label: cellLabel(key, count),
    });
  }
  // Trailing pads to complete the final week.
  while (cells.length % 7 !== 0) {
    cells.push({
      dateKey: null, count: 0, level: 0,
      isToday: false, beforeWindow: false, future: false, label: "",
    });
  }

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { weeks, title: `${MONTHS_FULL[month]} ${year}` };
}

export interface MonthNavBounds {
  /** a previous month still contains an in-window (or future-of-window) day */
  canPrev: boolean;
  /** the displayed month is before the current month */
  canNext: boolean;
}

/** Month navigation clamped to the 12-week data window (older months
 *  hold no counts in the reused engine, so navigating there would
 *  render a falsely-empty month). */
export function monthNavBounds(
  year: number,
  month: number,
  windowStartKey: string,
  todayKey: string,
): MonthNavBounds {
  // First day of the displayed month; previous month's grid is allowed
  // while that month contains at least one day >= windowStart.
  const displayedFirst = toKey(new Date(year, month, 1));
  const prevMonthLast = toKey(new Date(year, month, 0));
  const today = new Date(`${todayKey}T00:00:00`);
  const canNext = compareKeys(displayedFirst, toKey(new Date(today.getFullYear(), today.getMonth(), 1))) < 0;
  return { canPrev: compareKeys(prevMonthLast, windowStartKey) >= 0, canNext };
}

/** Shift a local year/month by a signed month delta. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Streak caption — real only. Returns null below 2 days (a single
 *  active day is not a streak worth claiming). */
export function streakCaption(currentStreak: number): string | null {
  if (currentStreak < 2) return null;
  return `You're on a ${currentStreak}-day streak`;
}

/** Format one numeric habit value + unit for the day sheet: trailing
 *  zeros trimmed ("7.5 h", "1.8 L"), thousands separators for large
 *  counts ("8,432 steps"). A bare done flag (no value) → "Done". */
export function formatHabitValue(value: number | null, unit: string | null): string {
  if (value === null) return "Done";
  const trimmed = Math.round(value * 10) / 10;
  const num = Math.abs(trimmed) >= 1000 ? trimmed.toLocaleString("en-US") : String(trimmed);
  return unit ? `${num} ${unit}` : num;
}
