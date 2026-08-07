/* ═══════════════════════════════════════════════════════════════
   Phase 56, Item 5 — drag-to-swap for the wizard's weekly split.
   Day labels (Mon–Sun) stay fixed; only the workout CONTENT swaps
   (active flag + workout name + dbId row identity), and the per-day
   exercise lists follow their content. Rest-day swaps work the same
   way (dragging a workout onto a rest day makes the source a rest).
   ═══════════════════════════════════════════════════════════════ */

export interface SplitDayLike {
  day: string;
  active: boolean;
  workout: string;
  dbId?: string;
}

export interface SwapResult<S, E> {
  split: S[];
  workoutExercises: Record<number, E[]> | undefined;
}

export function swapSplitContent<
  S extends SplitDayLike,
  E,
>(
  split: S[],
  workoutExercises: Record<number, E[]> | undefined,
  i: number,
  j: number,
  /** split day name → the 1-based key used by workoutExercises (Mon=1 … Sun=7) */
  dayKey: (day: string) => number,
): SwapResult<S, E> {
  if (i === j || !split[i] || !split[j]) return { split, workoutExercises };

  const next = split.map((d) => ({ ...d }));
  for (const k of ["active", "workout", "dbId"] as const) {
    const tmp = next[i][k];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next[i] as any)[k] = (next[j] as any)[k];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next[j] as any)[k] = tmp;
  }

  let nextWe = workoutExercises;
  if (workoutExercises) {
    const ki = dayKey(split[i].day);
    const kj = dayKey(split[j].day);
    nextWe = { ...workoutExercises };
    const tmp = nextWe[ki];
    nextWe[ki] = nextWe[kj];
    nextWe[kj] = tmp;
    if (nextWe[ki] === undefined) delete nextWe[ki];
    if (nextWe[kj] === undefined) delete nextWe[kj];
  }

  return { split: next, workoutExercises: nextWe };
}
