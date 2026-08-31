/* ═══════════════════════════════════════════════════════════════
   Full Body A/B/C rotation (Owner Tasks, Task 3) — the wizard's
   'Full Body' split used to leave every day on the ONE shared
   default list, so Full Body A/B/C rendered the identical 6
   exercises. These are the classic distinct lineups: a squat pattern
   every day, bench/overhead alternating, deadlift/row/pull-up
   accessories rotating, and varied rep schemes. A1↔A2 superset
   notation flows through the existing pair-group assignment.
   ═══════════════════════════════════════════════════════════════ */

/** Structural twin of the wizard's ProgramExercise (page type stays
 *  the source of truth; this keeps the lib dependency-free). */
export interface RotationExercise {
  code: string;
  name: string;
  sets: number;
  reps: string;
  pct1RM: string;
  tempo: string;
  rest: string;
}

export const FULL_BODY_ROTATION: RotationExercise[][] = [
  // Day A — bench emphasis, row + RDL accessories
  [
    { code: 'A1', name: 'Back Squat', sets: 5, reps: '5', pct1RM: '82.5%', tempo: '3-0-1-0', rest: '3:00' },
    { code: 'A2', name: 'Bench Press', sets: 5, reps: '5', pct1RM: '82.5%', tempo: '3-0-1-0', rest: '3:00' },
    { code: 'B1', name: 'Barbell Row', sets: 4, reps: '8', pct1RM: '75%', tempo: '3-1-1-0', rest: '2:30' },
    { code: 'B2', name: 'Romanian Deadlift', sets: 3, reps: '8', pct1RM: '75%', tempo: '3-1-1-0', rest: '2:30' },
    { code: 'C1', name: 'Walking Lunge', sets: 3, reps: '10/leg', pct1RM: 'N/A', tempo: '2-0-1-0', rest: '2:00' },
    { code: 'C2', name: 'Plank', sets: 3, reps: '45s', pct1RM: 'N/A', tempo: '2-0-1-0', rest: '1:30' },
  ],
  // Day B — overhead emphasis, deadlift + pulldown accessories
  [
    { code: 'A1', name: 'Back Squat', sets: 5, reps: '5', pct1RM: '82.5%', tempo: '3-0-1-0', rest: '3:00' },
    { code: 'A2', name: 'Overhead Press', sets: 5, reps: '5', pct1RM: '80%', tempo: '2-0-1-1', rest: '3:00' },
    { code: 'B1', name: 'Deadlift', sets: 4, reps: '5', pct1RM: '85%', tempo: '2-1-X-0', rest: '3:00' },
    { code: 'B2', name: 'Lat Pulldown', sets: 4, reps: '8', pct1RM: '75%', tempo: '3-0-2-0', rest: '2:30' },
    { code: 'C1', name: 'Bulgarian Split Squat', sets: 3, reps: '8/leg', pct1RM: 'N/A', tempo: '2-0-1-0', rest: '2:00' },
    { code: 'C2', name: 'Side Plank', sets: 3, reps: '30s/side', pct1RM: 'N/A', tempo: '2-0-1-0', rest: '1:30' },
  ],
  // Day C — bench volume (varied scheme), pull-up + hip thrust
  [
    { code: 'A1', name: 'Back Squat', sets: 4, reps: '6', pct1RM: '80%', tempo: '3-0-1-0', rest: '3:00' },
    { code: 'A2', name: 'Bench Press', sets: 4, reps: '6', pct1RM: '80%', tempo: '3-1-1-0', rest: '3:00' },
    { code: 'B1', name: 'Pull-Up', sets: 4, reps: '8', pct1RM: 'BW', tempo: '3-0-2-0', rest: '2:30' },
    { code: 'B2', name: 'Hip Thrust', sets: 3, reps: '10', pct1RM: '75%', tempo: '2-0-1-0', rest: '2:00' },
    { code: 'C1', name: 'Goblet Squat', sets: 3, reps: '12', pct1RM: 'N/A', tempo: '2-0-1-0', rest: '1:30' },
    { code: 'C2', name: 'Dead Bug', sets: 3, reps: '8/side', pct1RM: 'N/A', tempo: '2-0-1-0', rest: '1:30' },
  ],
];

/** Map a split's ACTIVE days (in order) to the A/B/C rotation, keyed by
 *  the wizard's 1-based day index (Mon=1 … Sun=7). More than 3 active
 *  days cycles the rotation. Returns {} when nothing is active. */
export function fullBodyWorkoutExercises(
  split: { day: string; active: boolean }[],
  dayKey: (day: string) => number,
): Record<number, RotationExercise[]> {
  const out: Record<number, RotationExercise[]> = {};
  let n = 0;
  for (const d of split) {
    if (!d.active) continue;
    out[dayKey(d.day)] = FULL_BODY_ROTATION[n % FULL_BODY_ROTATION.length].map((e) => ({ ...e }));
    n++;
  }
  return out;
}
