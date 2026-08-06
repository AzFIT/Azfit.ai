/* ═══════════════════════════════════════════════════════════════════
   Session credits + availability (Phase 50) — pure logic.
   Credits are DERIVATIVE: no stored counter. remaining = Σ total_credits
   − sessions (scheduled|completed) created on/after the EARLIEST active
   package's created_at (the packages form a pool — a renewal package
   bought later doesn't re-charge older sessions; documented choice).
   ═══════════════════════════════════════════════════════════════════ */

export interface PackageLike {
  id: string;
  total_credits: number;
  created_at: string | null;
}

export interface SessionLike {
  status: string | null;
  created_at: string | null;
}

export function remainingCredits(
  packages: PackageLike[],
  sessions: SessionLike[],
): number {
  if (packages.length === 0) return 0;
  const earliest = Math.min(
    ...packages.map((p) => new Date(p.created_at ?? 0).getTime()),
  );
  const total = packages.reduce((s, p) => s + p.total_credits, 0);
  const used = sessions.filter(
    (s) =>
      (s.status === "scheduled" || s.status === "completed") &&
      s.created_at !== null &&
      new Date(s.created_at).getTime() >= earliest,
  ).length;
  return Math.max(0, total - used);
}

export interface AvailabilityWindow {
  weekday: number; // 1=Mon … 7=Sun
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
}

const toMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Monday-first weekday for a YYYY-MM-DD date (client-local). */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1;
}

/**
 * Is a booking inside the trainer's availability? Containment is by
 * START time within any window for that weekday; blocked dates always
 * fail. An empty template (no windows AND no blocked dates) is "no
 * opinion" — callers render nothing (brief: honest absence).
 */
export function isWithinAvailability(
  windows: AvailabilityWindow[],
  blockedDates: string[],
  date: string,
  startTime: string,
): boolean {
  if (blockedDates.includes(date)) return false;
  const wd = weekdayOf(date);
  const t = toMinutes(startTime);
  return windows.some(
    (w) => w.weekday === wd && t >= toMinutes(w.start_time) && t < toMinutes(w.end_time),
  );
}

export function hasAvailabilityTemplate(
  windows: AvailabilityWindow[],
  blockedDates: string[],
): boolean {
  return windows.length > 0 || blockedDates.length > 0;
}
