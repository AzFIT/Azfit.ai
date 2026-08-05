/* ═══════════════════════════════════════════════════════════════════
   Trainer Weekly Digest (Phase 45) — pure aggregation + sorting.
   Data-source mapping (documented):
   - Check-in  ← check_in_submissions (this week + latest prior for Δ)
   - Training  ← workout_logs completed (completed_at in week) — the
     sessions table is too sparse to be meaningful (2 rows live), so
     sessions appear only as a scheduled-count side note
   - Nutrition ← nutrition_logs + nutrition_targets (via the 38
     weeklyAdherence engine with the week's Sunday as anchor)
   - Program   ← programs.status='active' (latest)
   ═══════════════════════════════════════════════════════════════════ */

import { currentWeekStart } from "@/lib/checkinWeek";

const DAY_MS = 86400000;

export interface WeekWindow {
  start: Date; // Monday 00:00 local
  end: Date; // exclusive (next Monday)
}

/** weekOffset 0 = current week, 1 = previous, … */
export function weekWindow(weekOffset: number, now = new Date()): WeekWindow {
  const start = new Date(
    currentWeekStart(now).getTime() - Math.max(0, weekOffset) * 7 * DAY_MS,
  );
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

export function inWindow(ts: string | Date, w: WeekWindow): boolean {
  const t = typeof ts === "string" ? new Date(ts) : ts;
  return t >= w.start && t < w.end;
}

export interface DigestRowInput {
  checkinThisWeek: boolean;
  weightDelta: number | null;
  workoutsCompleted: number;
  sessionsScheduled: number;
  daysLogged: number; // 0–7
  kcalPct: number | null; // avg kcal vs target %; null when no targets/logs
  hasProgram: boolean;
}

/**
 * Attention priority (lower = needs attention sooner):
 * no check-in (0) > no workouts (1) > no logs (2) > no program (3) > all good (4).
 */
export function attentionRank(r: DigestRowInput): number {
  if (!r.checkinThisWeek) return 0;
  if (r.workoutsCompleted === 0) return 1;
  if (r.daysLogged === 0) return 2;
  if (!r.hasProgram) return 3;
  return 4;
}

export function sortDigestRows<T extends { name: string } & DigestRowInput>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) => attentionRank(a) - attentionRank(b) || a.name.localeCompare(b.name),
  );
}

export interface HeaderSummary {
  checkedIn: number;
  total: number;
  workoutsCompleted: number; // roster-wide, this week
  loggedAny: number; // clients with ≥1 logged day
}

/** Header strip numbers — computed from the SAME rows the table shows. */
export function summarizeRows<T extends DigestRowInput>(rows: T[]): HeaderSummary {
  return {
    checkedIn: rows.filter((r) => r.checkinThisWeek).length,
    total: rows.length,
    workoutsCompleted: rows.reduce((s, r) => s + r.workoutsCompleted, 0),
    loggedAny: rows.filter((r) => r.daysLogged > 0).length,
  };
}
