/* ═══════════════════════════════════════════════════════════════
   Phase 59 — bento dashboard pure helpers (unit-tested).
   Honest-data rule: a delta is null when there's no real basis.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Week-over-week delta as a rounded percent. Null when there's no
 * honest basis (no previous period, or previous = 0 — "0 → 3" is
 * not a percentage). Sign preserved; the caller picks chip colors.
 */
export function wowDeltaPct(current: number, previous: number | null | undefined): number | null {
  if (previous == null || !Number.isFinite(previous) || previous <= 0) return null;
  if (!Number.isFinite(current) || current < 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Compliance share (0–100) for a week window: completed / all non-cancelled. */
export function weeklyComplianceShare(sessions: { status: string }[]): number | null {
  const valid = sessions.filter((s) => s.status !== "cancelled");
  if (valid.length === 0) return null;
  const completed = valid.filter((s) => s.status === "completed").length;
  return Math.round((completed / valid.length) * 100);
}

/* ── Weekly training volume from workout_log entries ────────────
   Each entry carries per-set arrays; volume = Σ weight×reps over
   the sets that have BOTH values (partial sets are skipped, never
   zero-filled). Day buckets are Mon=0 … Sun=6 of the LOCAL week. */
export interface VolumeEntryRow {
  completed_at: string; // parent workout_logs.completed_at
  weight_per_set: number[] | null;
  reps_per_set: number[] | null;
}

export interface WeeklyVolume {
  dayTotals: number[]; // [Mon..Sun]
  total: number;
  max: number;
  maxDayIdx: number; // -1 when everything is zero
}

export function weeklyVolumeByDay(rows: VolumeEntryRow[]): WeeklyVolume {
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const d = new Date(r.completed_at);
    if (isNaN(d.getTime())) continue;
    const idx = (d.getDay() + 6) % 7;
    const w = r.weight_per_set ?? [];
    const reps = r.reps_per_set ?? [];
    const n = Math.min(w.length, reps.length);
    let v = 0;
    for (let i = 0; i < n; i++) {
      const wi = Number(w[i]);
      const ri = Number(reps[i]);
      if (Number.isFinite(wi) && Number.isFinite(ri)) v += wi * ri;
    }
    dayTotals[idx] += v;
  }
  const total = dayTotals.reduce((a, b) => a + b, 0);
  const max = Math.max(...dayTotals);
  return { dayTotals, total, max, maxDayIdx: max > 0 ? dayTotals.indexOf(max) : -1 };
}

/** "18.4k kg" formatting; null when zero (header shows "—"). */
export function formatVolumeKg(kg: number): string | null {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  if (kg >= 1000) return `${(Math.round(kg / 100) / 10).toFixed(1)}k kg`;
  return `${Math.round(kg)} kg`;
}

/** Avatar initials from a full name ("Jonny Mclarnon" → "JM", "HK" → "HK"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[1][0] ?? "")).toUpperCase();
}

/* ── Today timeline status chip (documented mapping) ────────────
   sessions have no "confirmed" column, so: completed → Confirmed
   (success), scheduled → Pending (warning), and a client with an
   overdue check-in shows "Check-in due" (danger) instead. */
export type TimelineChip = "Confirmed" | "Pending" | "Check-in due";

export function timelineChip(sessionStatus: string, checkinDue: boolean): TimelineChip {
  if (sessionStatus === "completed") return "Confirmed";
  if (checkinDue) return "Check-in due";
  return "Pending";
}
