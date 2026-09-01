/* ═══════════════════════════════════════════════════════════════
   Phase 65A — pattern-aware per-day seeding + split reconciliation
   for the Program Creator wizard.

   THE SYNC BUG this fixes: applySplit/toggleDay used to replace the
   weekly split's day labels WITHOUT touching the per-day exercise
   map — Step 6/7/8 kept showing (and saving) the old split's lists
   under the new labels (the "Barbell Row on a Push day" repro was a
   stale Full-Body rotation surviving a split-type change).

   Seeding is DETERMINISTIC (no Math.random): candidates come from the
   hardcoded EXERCISE_CATEGORIES pools, which are pattern-correct by
   construction — a pressing slot can only ever yield a press.
   ═══════════════════════════════════════════════════════════════ */

import { getExercisesByCategory } from "@/data/exerciseDatabase";
import type { SplitDayLike } from "./wizardSplit";

/** Structural twin of the wizard's ProgramExercise (the page type stays
 *  the source of truth; this keeps the lib dependency-free). */
export interface SeededExercise {
  code: string;
  name: string;
  sets: number;
  reps: string;
  pct1RM: string;
  tempo: string;
  rest: string;
}

export const SEEDED_EXERCISES_PER_DAY = 6;

/* Phase 48 added-exercise fallback prescription — the wizard's
   established convention for any exercise that carries no method
   prefill (see Step 6 handlePicked). */
const PRESCRIPTION = { sets: 3, reps: "10", pct1RM: "N/A", tempo: "2-0-1-0", rest: "2:00" } as const;

const ORDER_PREFIXES = ["A1", "A2", "B1", "B2", "C1", "C2", "C3", "D"];

/* Day-label keyword → slot categories. First match wins; 'full' must beat
   the focus suffix ('Full Body 2 — Push + Legs' is NOT a legs day — 65B
   audit catch), and 'upper' must beat 'push'/'pull'. Unknown labels
   ('Workout A', trainer customs) get the full-body default mix. */
const LABEL_SLOTS: [RegExp, string[]][] = [
  [/full/i, ["pressing", "pulling", "bilateral_quad", "posterior", "delt_scap", "bracing"]],
  [/upper/i, ["pressing", "pulling", "pressing", "pulling", "delt_scap", "biceps"]],
  [/lower|legs|squat|quad|hinge|deadlift|ham/i, ["bilateral_quad", "posterior", "unilateral_quad", "posterior", "bracing", "metcon_bracing"]],
  [/arm/i, ["biceps", "triceps", "biceps", "triceps", "delt_scap", "bracing"]],
  [/push|chest|shoulder/i, ["pressing", "pressing", "delt_scap", "triceps", "delt_scap", "bracing"]],
  [/pull|back/i, ["pulling", "pulling", "biceps", "pulling", "biceps", "bracing"]],
];
const DEFAULT_DAY_SLOTS = ["pressing", "pulling", "bilateral_quad", "posterior", "delt_scap", "bracing"];

export function slotsForDayLabel(label: string): string[] {
  for (const [re, slots] of LABEL_SLOTS) if (re.test(label)) return slots;
  return DEFAULT_DAY_SLOTS;
}

/**
 * Seed one day's exercise list from its label's movement pattern.
 * Deterministic front-of-pool picks; `used` (names already placed this
 * week) is threaded by the caller so repeated labels (Push ×2 in PPL)
 * land on DIFFERENT exercises while the pools allow, and mutated as we
 * pick. A name never repeats within the same day; a slot is skipped
 * rather than filled with an off-pattern exercise.
 */
export function seedExercisesForDay(
  label: string,
  opts: { used?: Set<string>; size?: number } = {},
): SeededExercise[] {
  const size = opts.size ?? SEEDED_EXERCISES_PER_DAY;
  const slots = slotsForDayLabel(label);
  const used = opts.used;
  const pickedToday = new Set<string>();
  const out: SeededExercise[] = [];
  for (let i = 0; i < size && out.length < size; i++) {
    const candidates = getExercisesByCategory(slots[i % slots.length]);
    const chosen =
      candidates.find((n) => !pickedToday.has(n) && !used?.has(n)) ??
      candidates.find((n) => !pickedToday.has(n)) ??
      null;
    if (!chosen) continue;
    pickedToday.add(chosen);
    used?.add(chosen);
    out.push({ code: ORDER_PREFIXES[out.length] ?? `E${out.length - 7}`, name: chosen, ...PRESCRIPTION });
  }
  return out;
}

/** Seed lists for every ACTIVE day of a split (Mon=1 … Sun=7 keys). */
export function seedExercisesForSplit<S extends SplitDayLike>(
  split: S[],
  dayKey: (day: string) => number,
): Record<number, SeededExercise[]> {
  const used = new Set<string>();
  const out: Record<number, SeededExercise[]> = {};
  for (const d of split) {
    if (!d.active) continue;
    out[dayKey(d.day)] = seedExercisesForDay(d.workout, { used });
  }
  return out;
}

/**
 * THE SYNC PRIMITIVE. Reconcile the per-day exercise map with a new
 * split after a split-type change or day toggle:
 *  - result keys are EXACTLY the new split's active days (orphaned
 *    lists from the old split are pruned — they used to leak into
 *    Step 7/8 stats and saves);
 *  - a day whose weekday + workout label is unchanged KEEPS its list
 *    (trainer edits and exercise dbIds survive e.g. a preset reselect);
 *  - anything else (new label, newly activated day, re-activated day)
 *    is re-seeded pattern-aware via seedForDay.
 */
export function reconcileWorkoutExercises<S extends SplitDayLike, E extends { name: string }>(
  prevSplit: S[],
  nextSplit: S[],
  prevMap: Record<number, E[]> | undefined,
  dayKey: (day: string) => number,
  seedForDay: (label: string, used: Set<string>) => E[],
): Record<number, E[]> {
  const out: Record<number, E[]> = {};
  const used = new Set<string>();
  nextSplit.forEach((d, i) => {
    if (!d.active) return;
    const key = dayKey(d.day);
    const prev = prevSplit[i];
    const carried =
      prev && prev.day === d.day && prev.active && prev.workout === d.workout ? prevMap?.[key] : undefined;
    out[key] = carried ?? seedForDay(d.workout, used);
    for (const e of out[key]) used.add(e.name);
  });
  return out;
}

/**
 * Carry workout-row dbIds onto a new split wherever weekday + active +
 * label all match. Without this, applySplit silently drops every dbId
 * and the next save diffs an empty keep-set → deletes + re-inserts ALL
 * workout rows, breaking workout_logs.workout_id link preservation.
 */
export function preserveSplitIds<S extends SplitDayLike>(prev: S[], next: S[]): S[] {
  return next.map((d, i) => {
    const p = prev[i];
    return p && p.day === d.day && p.active === d.active && p.workout === d.workout
      ? { ...d, dbId: p.dbId }
      : { ...d };
  });
}
