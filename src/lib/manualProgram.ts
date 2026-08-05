/* ═══════════════════════════════════════════════════════════════════
   Manual Program Builder (Phase 42) — pure model/validation/save
   mapping. The persisted rows mirror src/lib/aiProgramMapper.ts
   EXACTLY (programs/workouts/exercises shape, order_index, notes JSON)
   so Sessions, the 36 preview, 34 PDF print, 30C badges and the 33C
   player all work unchanged.
   ═══════════════════════════════════════════════════════════════════ */

import { codeFromOrderIndex } from "@/lib/aiProgramMapper";
import { normalizeOrderLabels } from "@/lib/exerciseLabels";
import type { Database } from "@/types/supabase";

export interface ManualExercise {
  /** local UI id (not persisted) */
  id: string;
  name: string;
  sets: string;
  reps: string;
  tempo: string;
  /** superset group letter A–H, or null for ungrouped */
  group: string | null;
}

export interface ManualDay {
  id: string; // local UI id
  name: string;
  exercises: ManualExercise[];
}

export interface ManualProgramDraft {
  name: string;
  description: string;
  weeks: number; // 1–12
  days: ManualDay[];
}

export const MAX_WEEKS = 12;
export const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** Display labels exactly as the renderers derive them (30C/33C/36):
 * explicit group wins, else the order-code letter; then normalized so
 * singletons collapse to the plain letter and pairs number up. */
export function manualLabels(exercises: ManualExercise[]): string[] {
  const raw = exercises.map(
    (ex, i) => ex.group ?? codeFromOrderIndex(i).charAt(0),
  );
  return normalizeOrderLabels(raw);
}

/** Inline validation — every error is human-readable; save is blocked
 * on any of these (never a dead button, the list shows why). */
export function validateManualProgram(draft: ManualProgramDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Program name is required");
  if (!Number.isFinite(draft.weeks) || draft.weeks < 1 || draft.weeks > MAX_WEEKS) {
    errors.push(`Duration must be 1–${MAX_WEEKS} weeks`);
  }
  if (draft.days.length === 0) {
    errors.push("Add at least one day");
  }
  draft.days.forEach((day, i) => {
    const label = day.name.trim() || `Day ${i + 1}`;
    if (day.exercises.length === 0) {
      errors.push(`${label}: add at least one exercise`);
    }
    day.exercises.forEach((ex) => {
      if (!ex.name.trim()) errors.push(`${label}: every exercise needs a name`);
      const sets = parseInt(ex.sets, 10);
      if (!Number.isFinite(sets) || sets < 1 || sets > 20) {
        errors.push(`${label} · ${ex.name || "exercise"}: sets must be 1–20`);
      }
      if (!ex.reps.trim()) {
        errors.push(`${label} · ${ex.name || "exercise"}: reps are required`);
      }
    });
  });
  return errors;
}

type ProgramInsert = Database["public"]["Tables"]["programs"]["Insert"];
type WorkoutInsert = Database["public"]["Tables"]["workouts"]["Insert"];
type ExerciseInsert = Database["public"]["Tables"]["exercises"]["Insert"];

/** programs row — mirrors buildProgramInsert for an assigned program:
 * status active, start today, end today + weeks; phases/progression
 * stay null (manual programs are single-phase, no rules engine).
 * Phase 48, Item 4: when a method is chosen, its slug rides in a
 * single-phase jsonb array (same additive channel as the wizard) so the
 * Programs-tab badge resolves. */
export function buildManualProgramInsert(
  draft: ManualProgramDraft,
  trainerId: string,
  clientId: string,
  today: string, // YYYY-MM-DD (injected for testability)
  methodSlug?: string,
): ProgramInsert {
  const weeks = Math.max(1, Math.min(MAX_WEEKS, Math.round(draft.weeks)));
  const [y, m, d] = today.split("-").map(Number);
  const endMs = Date.UTC(y, m - 1, d) + weeks * 7 * 86400000;
  const end = new Date(endMs).toISOString().split("T")[0];
  return {
    trainer_id: trainerId,
    client_id: clientId,
    name: draft.name.trim(),
    description: draft.description.trim() || null, // honest: empty stays null
    duration_weeks: weeks,
    frequency_per_week: Math.max(1, draft.days.length), // derived from days
    status: "active",
    start_date: today,
    end_date: end,
    phases: methodSlug
      ? ([
          { id: "p1", name: "Program Phase", weeks, focus: "", color: "#00AEEF", active: true, method: methodSlug },
        ] as unknown as ProgramInsert["phases"])
      : null,
    progression_rules: null,
  };
}

/** workouts rows — day_of_week assigned sequentially 1..N (manual
 * programs don't model rest-day placement; documented choice). */
export function buildManualWorkoutRows(
  days: ManualDay[],
): Array<Omit<WorkoutInsert, "program_id">> {
  return days.map((d, i) => ({
    name: d.name.trim() || `Day ${i + 1}`,
    day_of_week: i + 1,
    week_number: 1,
    notes: null,
  }));
}

/** exercises rows — identical shape to buildExerciseRows: sequential
 * order_index, null weight/rpe, 60s default rest, notes JSON with
 * tempo (only when set), pct1RM N/A, and supersetGroup when grouped. */
export function buildManualExerciseRows(
  exercises: ManualExercise[],
): Array<Omit<ExerciseInsert, "workout_id">> {
  return exercises.map((ex, i) => ({
    name: ex.name.trim(),
    sets: Math.max(1, Math.min(20, parseInt(ex.sets, 10) || 0)),
    reps: ex.reps.trim(),
    weight_kg: null,
    rest_seconds: 60,
    rpe: null,
    order_index: i,
    notes: JSON.stringify({
      ...(ex.tempo.trim() ? { tempo: ex.tempo.trim() } : {}),
      pct1RM: "N/A",
      ...(ex.group ? { supersetGroup: ex.group } : {}),
    }),
  }));
}
