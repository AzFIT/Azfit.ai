/* ═══════════════════════════════════════════════════════════════
   Phase 65B Item 5 — client "history with this method" derivation.
   Phase 48 persists the 30A method slug as phases[0].method on saved
   programs; sessions come from workout_logs (+ entries for volume).
   All math is honest: no history → empty summary, never fabricated.
   ═══════════════════════════════════════════════════════════════ */

export interface MethodSessionVolume {
  completedAt: string;
  volumeKg: number;
}

export interface MethodHistorySummary {
  sessionsCompleted: number;
  firstVolumeKg: number | null;
  lastVolumeKg: number | null;
  /** null when < 2 sessions or the first session has zero volume */
  volumeChangePct: number | null;
}

/** Does a saved program's phases jsonb carry this method slug? */
export function programUsesMethod(phases: unknown, slug: string): boolean {
  if (!slug || !Array.isArray(phases)) return false;
  return phases.some(
    (p) => typeof p === "object" && p !== null && (p as { method?: unknown }).method === slug,
  );
}

/** Σ weight×reps for one workout_log_entries row — the same pairing math
 *  as the Phase 59 weekly-volume tile (partial pairs skipped). */
export function entryVolumeKg(entry: { weight_per_set: unknown; reps_per_set: unknown }): number {
  const w = Array.isArray(entry.weight_per_set) ? entry.weight_per_set : [];
  const r = Array.isArray(entry.reps_per_set) ? entry.reps_per_set : [];
  let v = 0;
  for (let i = 0; i < Math.min(w.length, r.length); i++) {
    const wi = Number(w[i]);
    const ri = Number(r[i]);
    if (Number.isFinite(wi) && Number.isFinite(ri)) v += wi * ri;
  }
  return v;
}

/** Chronological summary: sessions completed + volume change first → last. */
export function summarizeMethodHistory(sessions: MethodSessionVolume[]): MethodHistorySummary {
  const sorted = sessions
    .filter((s) => s.completedAt && !Number.isNaN(new Date(s.completedAt).getTime()))
    .sort((a, b) => +new Date(a.completedAt) - +new Date(b.completedAt));
  const n = sorted.length;
  if (n === 0) return { sessionsCompleted: 0, firstVolumeKg: null, lastVolumeKg: null, volumeChangePct: null };
  const first = sorted[0].volumeKg;
  const last = sorted[n - 1].volumeKg;
  const volumeChangePct = n >= 2 && first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : null;
  return { sessionsCompleted: n, firstVolumeKg: first, lastVolumeKg: last, volumeChangePct };
}
