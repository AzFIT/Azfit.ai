/* ═══════════════════════════════════════════════════════════════════
   Workout intelligence (Phase 49) — pure logic.
   Ghost data (last-session values), method rest parsing, wave mapping,
   high-volume set targets. All consumed by the workout player only.
   ═══════════════════════════════════════════════════════════════════ */

export interface GhostSet {
  weight?: number;
  reps?: number;
  rpe?: number;
}

export interface LogEntryRow {
  exercise_name: string;
  weight_per_set: unknown;
  reps_per_set: unknown;
  rpe_per_set: unknown;
}

const asNumArr = (v: unknown): number[] =>
  Array.isArray(v) ? v.map((x) => Number(x) || 0) : [];

/**
 * Latest previous set values per exercise. Input rows MUST be newest-first
 * (SQL order created_at desc, already filtered to completed logs before
 * today). The ghost set = the LAST non-zero set of that entry. Exercises
 * with no history simply don't appear (callers render nothing).
 */
export function latestGhostByExercise(rows: LogEntryRow[]): Map<string, GhostSet> {
  const out = new Map<string, GhostSet>();
  for (const row of rows) {
    if (out.has(row.exercise_name)) continue;
    const weights = asNumArr(row.weight_per_set);
    const reps = asNumArr(row.reps_per_set);
    const rpes = asNumArr(row.rpe_per_set);
    // last set index with any non-zero value
    for (let i = weights.length - 1; i >= 0; i--) {
      const w = weights[i] || 0;
      const r = reps[i] || 0;
      const rp = rpes[i] || 0;
      if (w > 0 || r > 0 || rp > 0) {
        const ghost: GhostSet = {};
        if (w > 0) ghost.weight = w;
        if (r > 0) ghost.reps = r;
        if (rp > 0) ghost.rpe = rp;
        out.set(row.exercise_name, ghost);
        break;
      }
    }
  }
  return out;
}

/** Render the ghost line; null when nothing to show (never a placeholder). */
export function ghostText(g: GhostSet | undefined): string | null {
  if (!g) return null;
  const parts: string[] = [];
  if (g.weight !== undefined) parts.push(`${g.weight} kg`);
  if (g.reps !== undefined) parts.push(`× ${g.reps}`);
  if (g.rpe !== undefined) parts.push(`@ RPE ${g.rpe}`);
  return parts.length ? `Last: ${parts.join(" ")}` : null;
}

/**
 * Method rest string → seconds (documented): a range takes the MIDPOINT
 * ("60–90s" → 75, "2–3 min" → 150); a single value parses directly;
 * unparseable ("Minimal — race the clock", "Variable") → null.
 */
export function parseRestSeconds(rest: string): number | null {
  const range = rest.match(/(\d+)\s*–\s*(\d+)\s*s\b/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const singleSec = rest.match(/^(\d+)\s*s\b/);
  if (singleSec) return Number(singleSec[1]);
  const minRange = rest.match(/(\d+)\s*–\s*(\d+)\s*min/);
  if (minRange) return Math.round(((Number(minRange[1]) + Number(minRange[2])) / 2) * 60);
  const singleMin = rest.match(/(\d+)\s*min/);
  if (singleMin) return Number(singleMin[1]) * 60;
  return null;
}

/**
 * Wave indicator (wave-loading): the pattern is "3/2/1 × 3–4 waves" —
 * 3 sets per wave; the wave index derives from completed sets.
 * Returns { wave, maxWaves } or null when setsReps isn't a wave pattern.
 */
export function waveProgress(
  setsReps: string,
  completedSets: number,
): { wave: number; maxWaves: number } | null {
  const m = setsReps.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)[^\d]+(\d+)\s*–\s*(\d+)\s*waves?/i);
  if (!m) return null;
  const setsPerWave = 3; // 3/2/1 = three sets
  const maxWaves = Number(m[5]);
  const wave = Math.min(maxWaves, Math.floor(completedSets / setsPerWave) + 1);
  return { wave, maxWaves };
}

/**
 * High-volume set target per exercise (GVT-style): "10×10" → 10.
 * Only fires when sets ≥ 8 (single-lift high-volume methods); null else.
 */
export function highVolumeSets(setsReps: string): number | null {
  const m = setsReps.match(/(\d+)\s*[×x]\s*\d+/);
  if (!m) return null;
  const sets = Number(m[1]);
  return sets >= 8 ? sets : null;
}
