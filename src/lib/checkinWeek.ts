/* ═══════════════════════════════════════════════════════════════════
   Weekly check-in week computation (Phase 44) — pure.
   A check-in week runs Monday 00:00 → Sunday 23:59:59 CLIENT-LOCAL.
   ═══════════════════════════════════════════════════════════════════ */

const DAY_MS = 86400000;

/** Monday 00:00 (local) of the week containing `date`. */
export function currentWeekStart(date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): Sun=0 … Sat=6 → Monday is 1 day back, Sunday 6 days back
  const back = (d.getDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY_MS);
}

/** Is `ts` inside the current (Monday-start) week containing `now`? */
export function isInCurrentWeek(ts: string | Date, now = new Date()): boolean {
  const t = typeof ts === "string" ? new Date(ts) : ts;
  const start = currentWeekStart(now);
  const end = new Date(start.getTime() + 7 * DAY_MS);
  return t >= start && t < end;
}

/** YYYY-MM-DD (local) of the week's Monday — display/label use. */
export function currentWeekLabel(now = new Date()): string {
  const s = currentWeekStart(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
}

/**
 * Due-badge logic (Phase 44, trainer overdue view): a client is due
 * when they have NO submission in the current week. Returns the
 * overdue rank for sorting: 0 = submitted this week (not due);
 * otherwise 1 + whole weeks since the last submission (Infinity when
 * never submitted — most overdue first).
 */
export function overdueRank(
  lastSubmittedAt: string | null,
  now = new Date(),
): number {
  if (lastSubmittedAt && isInCurrentWeek(lastSubmittedAt, now)) return 0;
  if (!lastSubmittedAt) return Number.POSITIVE_INFINITY;
  const start = currentWeekStart(now);
  const last = new Date(lastSubmittedAt);
  const weeks = Math.max(
    1,
    Math.floor((start.getTime() - currentWeekStart(last).getTime()) / (7 * DAY_MS)),
  );
  return weeks;
}
