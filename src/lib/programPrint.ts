/**
 * Program print model (Phase 34) — pure mapper from saved program data (or a
 * wizard draft) to a print-ready structure. No fabrication: empty fields are
 * omitted by the renderer, never placeholder-printed.
 */

import type { Database, Json } from "@/types/supabase";
import { codeFromOrderIndex, parseExerciseNotes, restStringFromSeconds } from "@/lib/aiProgramMapper";
import { normalizeOrderLabels } from "@/lib/exerciseLabels";
import type { ProgramData, ProgramExercise } from "@/pages/AIProgramBuilder";
import type { ProgressionRule } from "@/lib/progression";

type ProgramRow = Database["public"]["Tables"]["programs"]["Row"];
type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];
type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

export interface PrintExercise {
  order: string;
  name: string;
  setsReps: string; // "4 × 8-12"
  tempo: string | null;
  rest: string | null;
  notes: string[]; // safety markers / substitutions / free notes
}

export interface PrintDay {
  label: string; // "Monday — Upper Push Focus"
  exercises: PrintExercise[];
}

export interface PrintProgram {
  title: string;
  clientName: string;
  trainerName: string;
  createdDate: string | null;
  startDate: string | null;
  endDate: string | null;
  phaseNames: string[];
  days: PrintDay[];
  progressionRules: { label: string; text: string }[];
}

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function phaseNamesFromJson(phases: Json | null): string[] {
  if (!Array.isArray(phases)) return [];
  return (phases as unknown[])
    .filter((p): p is { name: string } => typeof p === "object" && p !== null && typeof (p as { name?: unknown }).name === "string")
    .map((p) => p.name);
}

function progressionRulesFromJson(rules: Json | null): { label: string; text: string }[] {
  if (!Array.isArray(rules)) return [];
  return (rules as unknown[])
    .filter(
      (r): r is { label: string; text: string } =>
        typeof r === "object" && r !== null &&
        typeof (r as { label?: unknown }).label === "string" &&
        typeof (r as { text?: unknown }).text === "string"
    )
    .map((r) => ({ label: r.label, text: r.text }));
}

function mapDbExercise(ex: ExerciseRow, normalizedCode?: string): PrintExercise {
  const extra = parseExerciseNotes(ex.notes);
  const code = normalizedCode ?? codeFromOrderIndex(ex.order_index);
  const notes: string[] = [];
  if (extra.isSubstituted) notes.push("Swapped for safety");
  if (extra.safetyNote && !extra.isSubstituted) notes.push(extra.safetyNote);
  // Tempo only when it was actually stored (parseExerciseNotes defaults 2-0-1-0
  // for missing notes — a default is not real data)
  let rawTempo: string | null = null;
  if (ex.notes) {
    try {
      rawTempo = (JSON.parse(ex.notes) as { tempo?: string }).tempo ?? null;
    } catch {
      rawTempo = null;
    }
  }
  return {
    order: code,
    name: ex.name,
    setsReps: `${ex.sets ?? 0} × ${ex.reps || "—"}`,
    tempo: rawTempo && rawTempo !== "N/A" ? rawTempo : null,
    rest: ex.rest_seconds ? restStringFromSeconds(ex.rest_seconds) : null,
    notes,
  };
}

/** Saved program (DB rows) → print model. */
export function buildPrintModel(
  program: ProgramRow,
  workouts: WorkoutRow[],
  exercises: ExerciseRow[],
  clientName: string,
  trainerName: string
): PrintProgram {
  const days = [...workouts]
    .sort((a, b) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0))
    .map((w) => {
      const dayExercises = exercises
        .filter((e) => e.workout_id === w.id)
        .sort((a, b) => a.order_index - b.order_index);
      // Phase 36/42: normalize the EFFECTIVE display labels per day —
      // explicit supersetGroup wins over the order-code letter (same
      // rule as the preview and the session player), then normalize so
      // pairs number up (A A → A1 A2) and singletons stay plain.
      const dayLabels = normalizeOrderLabels(
        dayExercises.map(
          (e) =>
            parseExerciseNotes(e.notes).supersetGroup ??
            codeFromOrderIndex(e.order_index),
        ),
      );
      return {
        label: `${DAY_NAMES[w.day_of_week ?? 0] ?? `Day ${w.day_of_week}`} — ${w.name}`,
        exercises: dayExercises.map((e, i) => mapDbExercise(e, dayLabels[i])),
      };
    })
    .filter((d) => d.exercises.length > 0);

  return {
    title: program.name || "Untitled Program",
    clientName,
    trainerName,
    createdDate: shortDate(program.created_at),
    startDate: shortDate(program.start_date),
    endDate: shortDate(program.end_date),
    phaseNames: phaseNamesFromJson(program.phases),
    days,
    progressionRules: progressionRulesFromJson(program.progression_rules),
  };
}

function mapWizardExercise(ex: ProgramExercise): PrintExercise {
  const notes: string[] = [];
  if (ex.isSubstituted) notes.push("Swapped for safety");
  if (ex.safetyNote && !ex.isSubstituted) notes.push(ex.safetyNote);
  return {
    order: ex.supersetGroup ?? ex.code,
    name: ex.name,
    setsReps: `${ex.sets} × ${ex.reps || "—"}`,
    tempo: ex.tempo && ex.tempo !== "N/A" ? ex.tempo : null,
    rest: ex.rest || null,
    notes,
  };
}

const SPLIT_DAY_ORDER: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const SPLIT_DAY_LONG: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

/** In-memory wizard draft (ProgramData) → print model. */
export function buildPrintModelFromWizard(
  data: ProgramData,
  clientName: string,
  trainerName: string
): PrintProgram {
  const days = data.split
    .filter((d) => d.active)
    .sort((a, b) => (SPLIT_DAY_ORDER[a.day] ?? 99) - (SPLIT_DAY_ORDER[b.day] ?? 99))
    .map((d) => {
      const idx = SPLIT_DAY_ORDER[d.day] ?? 1;
      const list = data.workoutExercises?.[idx] ?? data.exercises;
      return {
        label: `${SPLIT_DAY_LONG[d.day] ?? d.day} — ${d.workout || "Workout"}`,
        exercises: list.map(mapWizardExercise),
      };
    })
    .filter((d) => d.exercises.length > 0);

  return {
    title: data.programName || "Draft Program",
    clientName,
    trainerName,
    createdDate: shortDate(new Date().toISOString()),
    startDate: null,
    endDate: null,
    phaseNames: data.phases.filter((p) => p.active).map((p) => p.name),
    days,
    progressionRules: (data.progressionRules as ProgressionRule[]).map((r) => ({ label: r.label, text: r.text })),
  };
}
