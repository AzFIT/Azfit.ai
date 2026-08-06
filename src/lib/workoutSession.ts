import type { SetType } from "@/lib/storage";

export interface SessionSet {
  setNumber: number;
  clientLoad: number;
  load: number;
  reps: number;
  rpe: number;
  done: boolean;
  restSeconds: number;
  type: SetType;
  tempo: string;
  note: string;
}

export interface SessionExercise {
  id: string; // DB exercise UUID
  order: string; // A1, A2, B1, etc.
  name: string;
  category: string;
  targetSets: number;
  targetReps: string;
  targetLoad: number;
  tempo: string;
  restSeconds: number;
  prescribedRpe?: number;
  equipment?: string; // Phase 33C Fix 5: barbell-only plate hint
  /** Phase 49: false when restSeconds came from the 60s fallback, not the
   * exercises row — only then may the method's default rest apply. */
  hasExplicitRest?: boolean;
  sets: SessionSet[];
  notes: string;
}

export const DEFAULT_TEMPO = "3-0-1-0";
export const SET_TYPES: SetType[] = ["Normal", "Warm-up", "Drop Set", "Back-off"];
export const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 210, 240, 300, 360];

export function getOrderCode(orderIndex: number): string {
  const groupIndex = Math.floor(orderIndex / 2);
  const withinGroup = (orderIndex % 2) + 1;
  const letter = String.fromCharCode(65 + groupIndex);
  return `${letter}${withinGroup}`;
}

export function parseFirstNumber(value: string): number {
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function parseTargetReps(reps: string): number {
  // e.g. "8-12" -> 8, "10" -> 10, "12 each" -> 12
  return parseFirstNumber(reps);
}

export function getTargetVolumeForExercise(exercise: SessionExercise): number {
  const reps = parseTargetReps(exercise.targetReps);
  // Phase 33C Fix 2: derive from the ACTUAL set count so Add/Remove Set
  // moves the target immediately; targetLoad is live (Fix 1).
  return exercise.sets.length * reps * exercise.targetLoad;
}

export function getLiftedVolumeForSet(set: SessionSet): number {
  return set.done ? set.load * set.reps : 0;
}

export function getLiftedVolumeForExercise(exercise: SessionExercise): number {
  return exercise.sets.reduce((sum, s) => sum + getLiftedVolumeForSet(s), 0);
}

export function getCompletedSetsCount(exercise: SessionExercise): number {
  return exercise.sets.filter((s) => s.done).length;
}

export function getAvgRpe(exercise: SessionExercise): number {
  const done = exercise.sets.filter((s) => s.done && s.rpe > 0);
  if (done.length === 0) return 0;
  return done.reduce((sum, s) => sum + s.rpe, 0) / done.length;
}

export function estimateOneRepMax(load: number, reps: number): number {
  // Epley formula: weight * (1 + reps / 30)
  if (load <= 0 || reps <= 0) return 0;
  return load * (1 + reps / 30);
}

export function getBestEstimatedOneRepMax(exercise: SessionExercise): number {
  return exercise.sets
    .filter((s) => s.done && s.load > 0 && s.reps > 0)
    .reduce((best, s) => Math.max(best, estimateOneRepMax(s.load, s.reps)), 0);
}

export function getBestSingleSetVolume(exercise: SessionExercise): number {
  return exercise.sets
    .filter((s) => s.done)
    .reduce((best, s) => Math.max(best, s.load * s.reps), 0);
}

export function getSessionVolume(exercises: SessionExercise[]): number {
  return exercises.reduce((sum, ex) => sum + getLiftedVolumeForExercise(ex), 0);
}

export function getSessionTargetVolume(exercises: SessionExercise[]): number {
  return exercises.reduce((sum, ex) => sum + getTargetVolumeForExercise(ex), 0);
}

export function getSessionCompletedSets(exercises: SessionExercise[]): number {
  return exercises.reduce((sum, ex) => sum + getCompletedSetsCount(ex), 0);
}

export function getSessionTotalSets(exercises: SessionExercise[]): number {
  return exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
}

export function getSessionAvgRpe(exercises: SessionExercise[]): number {
  const done = exercises.flatMap((ex) => ex.sets.filter((s) => s.done && s.rpe > 0));
  if (done.length === 0) return 0;
  return done.reduce((sum, s) => sum + s.rpe, 0) / done.length;
}

/**
 * Phase 33E: cascade a target-load change X → Y to the sets that FOLLOW the
 * target — every unfinished set whose clientLoad is 0 or still equals X.
 * Sets the user manually diverged (any other value) and done sets are
 * never touched. Pure.
 */
export function cascadeTargetLoad(sets: SessionSet[], prevTarget: number, nextTarget: number): SessionSet[] {
  return sets.map((s) =>
    !s.done && (s.clientLoad <= 0 || s.clientLoad === prevTarget)
      ? { ...s, clientLoad: nextTarget, load: nextTarget }
      : s
  );
}

export function createEmptySet(setNumber: number, defaults: Partial<SessionSet> = {}): SessionSet {
  return {
    setNumber,
    clientLoad: 0,
    load: 0,
    reps: 0,
    rpe: 0,
    done: false,
    restSeconds: 60,
    type: "Normal",
    tempo: DEFAULT_TEMPO,
    note: "",
    ...defaults,
  };
}

export function buildSessionExercise(
  dbExercise: {
    id: string;
    name: string;
    sets: number;
    reps: string;
    weight_kg: number | null;
    rest_seconds: number | null;
    rpe: number | null;
    order_index: number | null;
    notes: string | null;
  },
  category: string,
  lastLoadPerExercise: Record<string, number>
): SessionExercise {
  const targetLoad = typeof dbExercise.weight_kg === "number" ? dbExercise.weight_kg : 0;
  const restSeconds = dbExercise.rest_seconds ?? 60;
  const targetReps = dbExercise.reps ?? "10";
  const defaultReps = parseTargetReps(targetReps) || 10;
  const lastLoad = lastLoadPerExercise[dbExercise.name] ?? targetLoad;

  const sets: SessionSet[] = Array.from({ length: dbExercise.sets || 1 }, (_, i) =>
    createEmptySet(i + 1, {
      clientLoad: lastLoad,
      load: lastLoad,
      reps: defaultReps,
      restSeconds,
      tempo: DEFAULT_TEMPO,
    })
  );

  return {
    id: dbExercise.id,
    order: getOrderCode(dbExercise.order_index ?? 0),
    name: dbExercise.name,
    category,
    targetSets: dbExercise.sets || 1,
    targetReps,
    targetLoad,
    tempo: DEFAULT_TEMPO,
    restSeconds,
    hasExplicitRest: dbExercise.rest_seconds != null,
    prescribedRpe: dbExercise.rpe ?? undefined,
    sets,
    notes: dbExercise.notes ?? "",
  };
}

export function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface ProgramPhase {
  key: "accumulation" | "intensification" | "realization";
  label: string;
  color: string;
  startWeek: number;
  endWeek: number;
}

export function splitProgramIntoPhases(durationWeeks: number): ProgramPhase[] {
  const total = Math.max(1, durationWeeks);
  const phaseLength = Math.ceil(total / 3);
  return (
    [
      { key: "accumulation", label: "Accumulation", color: "#F59E0B", startWeek: 1, endWeek: Math.min(phaseLength, total) },
      { key: "intensification", label: "Intensification", color: "#EF4444", startWeek: phaseLength + 1, endWeek: Math.min(phaseLength * 2, total) },
      { key: "realization", label: "Realization", color: "#22C55E", startWeek: phaseLength * 2 + 1, endWeek: total },
    ] as ProgramPhase[]
  ).filter((p) => p.startWeek <= p.endWeek);
}

export function getCurrentPhase(phases: ProgramPhase[], currentWeek: number): ProgramPhase | undefined {
  return phases.find((p) => currentWeek >= p.startWeek && currentWeek <= p.endWeek) || phases[phases.length - 1];
}
