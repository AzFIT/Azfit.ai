/* ═══════════════════════════════════════════════════════════════
   consistencyMap (Phase 86) — pure derivation for the client
   consistency heatmap (GitHub-style, 12 weeks ending today,
   Monday-start columns, 7 rows Mon–Sun).

   WEIGHTING (documented — every cell traceable to these rules):
   · completed session      = 2 pts
   · done daily-plan item   = 1 pt
   · done habit log         = 1 pt (numeric value OR bare done flag)
   · check-in submission    = 2 pts
   A day's intensity = sum of the points of its REAL rows.

   INTENSITY LEVELS (5): 0 → none · 1–2 → 1 · 3–4 → 2 · 5–6 → 3 ·
   7+ → 4. Days with no rows are level 0 — the grid is never padded
   with fake activity.

   STRUCTURAL PADS: cells in the final column after today are neutral
   (dateKey null, no color, no tooltip, aria-hidden) — layout only,
   NOT data. The range starts on a Monday exactly, so there are no
   leading pads.

   DATE KEYS: callers pass LOCAL date keys (formatDateKeyLocal,
   Phase 64 pattern) — never raw UTC — or every cell shifts a day
   for +timezone users.
   ═══════════════════════════════════════════════════════════════ */

export const ACTIVITY_WEIGHTS = {
  session: 2,
  planItem: 1,
  habit: 1,
  checkin: 2,
} as const;

export const WEEKS = 12;

/** Legend ranges — level → human range (legend is not color-only). */
export const LEVEL_RANGES = ["0", "1–2", "3–4", "5–6", "7+"] as const;

export interface ConsistencyInputs {
  /** local date keys of COMPLETED sessions */
  sessionDates: string[];
  /** local date keys of DONE daily-plan items */
  planDates: string[];
  /** local date keys of DONE habit logs */
  habitDates: string[];
  /** local date keys of check-in submissions */
  checkinDates: string[];
  /** injectable for tests */
  today?: Date;
}

export interface ConsistencyCell {
  /** null = structural pad (future day); never data */
  dateKey: string | null;
  /** weighted point total (0 for pads and empty days) */
  count: number;
  /** 0–4 (see LEVEL_RANGES) */
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  /** "Wed 3 Sep — 2 activities" ("" for pads) */
  label: string;
}

export interface ConsistencyGrid {
  /** 12 columns × 7 cells, cells ordered Mon..Sun within a column */
  columns: ConsistencyCell[][];
  /** month label per column (null = same month as previous column) */
  monthLabels: (string | null)[];
  /** days in the window with any activity */
  totalActiveDays: number;
  /** highest single-day count in the window (0 = no data at all) */
  maxCount: number;
}

/** 12-week window: Monday of this week minus 11 weeks .. today (local keys). */
export function consistencyRange(today: Date = new Date()): { startKey: string; todayKey: string } {
  const dow = (today.getDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
  const start = new Date(monday);
  start.setDate(start.getDate() - (WEEKS - 1) * 7);
  return { startKey: toKey(start), todayKey: toKey(today) };
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Day-of-week label + short date: "Wed 3 Sep". Pure (local parse,
 *  fixed tables — no ICU variance between Node and browsers). */
export function formatCellDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

export function cellLabel(dateKey: string, count: number): string {
  const noun = count === 1 ? "activity" : "activities";
  return `${formatCellDate(dateKey)} — ${count === 0 ? "no" : count} ${noun}`;
}

/** Intensity bucket for a weighted count (see header). */
export function levelForCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** Weighted per-day totals from the four activity sources. */
export function countByDay(input: {
  sessionDates: string[];
  planDates: string[];
  habitDates: string[];
  checkinDates: string[];
}): Map<string, number> {
  const map = new Map<string, number>();
  const add = (key: string | null | undefined, w: number) => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + w);
  };
  for (const k of input.sessionDates) add(k, ACTIVITY_WEIGHTS.session);
  for (const k of input.planDates) add(k, ACTIVITY_WEIGHTS.planItem);
  for (const k of input.habitDates) add(k, ACTIVITY_WEIGHTS.habit);
  for (const k of input.checkinDates) add(k, ACTIVITY_WEIGHTS.checkin);
  return map;
}

export function buildConsistencyGrid(input: ConsistencyInputs): ConsistencyGrid {
  const today = input.today ?? new Date();
  const { startKey, todayKey } = consistencyRange(today);
  const counts = countByDay(input);

  // Walk Mon..today; everything after today in the final column is a pad.
  const columns: ConsistencyCell[][] = Array.from({ length: WEEKS }, () => []);
  const monthLabels: (string | null)[] = [];
  let totalActiveDays = 0;
  let maxCount = 0;

  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${todayKey}T00:00:00`);

  let prevMonth: number | null = null;
  for (let w = 0; w < WEEKS; w++) {
    const colMonday = new Date(start);
    colMonday.setDate(start.getDate() + w * 7);
    const month = colMonday.getMonth();
    monthLabels.push(month !== prevMonth ? MONTHS[month] : null);
    prevMonth = month;

    for (let day = 0; day < 7; day++) {
      const d = new Date(colMonday);
      d.setDate(colMonday.getDate() + day);
      if (d > end) {
        // Structural pad — future day: no color, no tooltip, not data.
        columns[w].push({ dateKey: null, count: 0, level: 0, isToday: false, label: "" });
        continue;
      }
      const key = toKey(d);
      const count = counts.get(key) ?? 0;
      if (count > 0) totalActiveDays++;
      if (count > maxCount) maxCount = count;
      columns[w].push({
        dateKey: key,
        count,
        level: levelForCount(count),
        isToday: key === todayKey,
        label: cellLabel(key, count),
      });
    }
  }

  return { columns, monthLabels, totalActiveDays, maxCount };
}
