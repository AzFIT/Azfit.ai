/* ═══════════════════════════════════════════════════════════════
   Auto-progression engine (Phase 62) — deterministic progressive
   overload from REAL logged history. Rule-based, reps-completion
   driven (the schema HAS rpe_per_set but these rules deliberately
   use reps only — no RPE-dependent branching this phase).
   Advisory only: the player renders a tap-to-apply chip; nothing
   auto-writes to programs or inputs.
   NOTE: named autoProgression.ts to avoid colliding with the
   Phase 30D src/lib/progression.ts (program progression rules).
   ═══════════════════════════════════════════════════════════════ */

export interface LoggedSet {
  weight: number;
  reps: number;
}

export type ProgressionAction = "increase" | "hold" | "decrease" | null;

export interface ProgressionSuggestion {
  action: ProgressionAction;
  suggestedWeight: number | null;
  reason: string;
}

export const NO_SUGGESTION: ProgressionSuggestion = { action: null, suggestedWeight: null, reason: "" };

/* ── rep range parsing ─────────────────────────────────────────
   "8-10" / "8–10" → { min: 8, max: 10 }; "10" → { min: 10, max: 10 };
   "AMRAP" / "" → { min: 0, max: 0 } (engine then holds/none). */
export function parseRepRange(reps: string): { min: number; max: number } {
  const range = reps.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const single = reps.match(/\d+/);
  const n = single ? parseInt(single[0], 10) : 0;
  return { min: n, max: n };
}

/** Round to the nearest 2.5 kg (never below 2.5). */
export function roundToPlateau(w: number): number {
  return Math.max(2.5, Math.round(w / 2.5) * 2.5);
}

/* ── the rule set ────────────────────────────────────────────── */
export interface ProgressionInput {
  prescribedSets: number;
  repRangeMin: number;
  repRangeMax: number;
  /** newest-first, up to 2 sessions; each = per-set {weight, reps} */
  history: LoggedSet[][];
}

/**
 * Suggest today's working weight from real logged history.
 * - INCREASE: latest session logged ≥ prescribedSets sets, ALL at the
 *   same weight, ALL hitting repRangeMax → one increment (+2.5 kg when
 *   the working weight is < 40 kg — documented upper/isolation
 *   heuristic — else +5 kg). Single increment from the NEWEST weight
 *   even when the previous session also topped out (no compounding).
 * - DECREASE: latest session missed repRangeMin on ≥2 sets → −5%.
 * - HOLD: anything else with history.
 * - NULL: no usable history / zero weights — render nothing.
 */
export function progressionSuggestion(input: ProgressionInput): ProgressionSuggestion {
  const latest = input.history[0];
  if (!latest || latest.length === 0 || input.repRangeMax <= 0) return NO_SUGGESTION;
  const sets = latest.filter((s) => s.weight > 0 && s.reps > 0);
  if (sets.length === 0) return NO_SUGGESTION;

  const workingWeight = sets[0].weight;
  const sameWeight = sets.every((s) => s.weight === workingWeight);
  const tops = sets.filter((s) => s.reps >= input.repRangeMax).length;

  // INCREASE — full session at the top of the range, uniform weight
  if (sameWeight && sets.length >= input.prescribedSets && sets.every((s) => s.reps >= input.repRangeMax)) {
    const inc = workingWeight < 40 ? 2.5 : 5;
    return {
      action: "increase",
      suggestedWeight: roundToPlateau(workingWeight + inc),
      reason: `All ${sets.length} sets hit ${input.repRangeMax} reps at ${workingWeight} kg — add ${inc} kg today`,
    };
  }

  // DECREASE — 2+ sets below the bottom of the range
  const misses = sets.filter((s) => s.reps < input.repRangeMin);
  if (misses.length >= 2) {
    const suggested = roundToPlateau(workingWeight * 0.95);
    if (suggested > 0 && suggested < workingWeight) {
      return {
        action: "decrease",
        suggestedWeight: suggested,
        reason: `Missed ${input.repRangeMin} reps on ${misses.length} sets — drop ~5% and rebuild`,
      };
    }
  }

  // HOLD — repeat the working weight with a short honest reason
  return {
    action: "hold",
    suggestedWeight: workingWeight,
    reason: `Repeat ${workingWeight} kg — ${tops} of ${sets.length} sets hit the top of the range`,
  };
}

/* ── history grouping (extends the 49 ghost query) ─────────────
   Ghost rows are per-ENTRY with per-set arrays and a workout_log_id;
   group them into per-exercise session lists (≤2, newest-first by
   the caller-supplied log order). */
export interface GhostEntryRow {
  exercise_name: string;
  workout_log_id: string;
  weight_per_set: unknown;
  reps_per_set: unknown;
}

const asNumArr = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => Number(x) || 0) : []);

export function sessionsByExercise(rows: GhostEntryRow[], logOrder: string[]): Map<string, LoggedSet[][]> {
  const byExercise = new Map<string, Map<string, LoggedSet[]>>();
  for (const row of rows) {
    const weights = asNumArr(row.weight_per_set);
    const reps = asNumArr(row.reps_per_set);
    const sets: LoggedSet[] = [];
    const n = Math.max(weights.length, reps.length);
    for (let i = 0; i < n; i++) {
      const w = weights[i] || 0;
      const r = reps[i] || 0;
      if (w > 0 || r > 0) sets.push({ weight: w, reps: r });
    }
    if (sets.length === 0) continue;
    let m = byExercise.get(row.exercise_name);
    if (!m) {
      m = new Map();
      byExercise.set(row.exercise_name, m);
    }
    // first entry for a given log wins (rows arrive newest-first)
    if (!m.has(row.workout_log_id)) m.set(row.workout_log_id, sets);
  }

  const rank = new Map(logOrder.map((id, i) => [id, i]));
  const out = new Map<string, LoggedSet[][]>();
  for (const [name, byLog] of byExercise) {
    const sessions = [...byLog.entries()]
      .sort((a, b) => (rank.get(a[0]) ?? 999) - (rank.get(b[0]) ?? 999))
      .slice(0, 2)
      .map(([, sets]) => sets);
    out.set(name, sessions);
  }
  return out;
}
