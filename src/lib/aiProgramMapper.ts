// ═══════════════════════════════════════════════════════════════════════
// AI Program Builder — ProgramData ↔ Supabase row mapper
// Pure functions: easy to unit test and reuse between pages.
// ═══════════════════════════════════════════════════════════════════════

import type { Database, Json } from "@/types/supabase";
import { normalizeOrderLabels } from "@/lib/exerciseLabels";
import type {
  ProgramData,
  ProgramExercise,
  ProgramSplit,
  ProgramPhase,
  ClientContext,
} from "@/pages/AIProgramBuilder";

type ProgramRow = Database["public"]["Tables"]["programs"]["Row"];
type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];
type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

export interface DbProgramInsert {
  trainer_id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  duration_weeks: number;
  frequency_per_week: number;
  status: "draft" | "active";
  start_date: string | null;
  end_date: string | null;
  phases: Json | null;
  progression_rules: Json | null;
}

export interface DbWorkoutInsert {
  program_id: string;
  name: string;
  day_of_week: number;
  week_number: number;
  notes: string | null;
}

export interface DbExerciseInsert {
  workout_id: string;
  name: string;
  sets: number;
  reps: string;
  weight_kg: number | null;
  rest_seconds: number;
  rpe: number | null;
  order_index: number;
  notes: string | null;
}

const DAY_TO_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const INDEX_TO_DAY = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function restSecondsFromString(rest: string): number {
  if (!rest) return 60;
  if (rest.includes(":")) {
    const [m, s] = rest.split(":").map((n) => parseInt(n, 10));
    if (Number.isFinite(m) && Number.isFinite(s)) return m * 60 + s;
  }
  const seconds = parseInt(rest, 10);
  return Number.isFinite(seconds) ? seconds : 60;
}

export function restStringFromSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function orderIndexFromCode(code: string): number {
  const match = /^([A-Z])(\d+)$/.exec(code);
  if (!match) {
    const letter = code.charAt(0);
    if (letter >= "A" && letter <= "Z") {
      return (letter.charCodeAt(0) - 65) * 2;
    }
    return 0;
  }
  const letterIndex = match[1].charCodeAt(0) - 65;
  const digit = parseInt(match[2], 10) || 1;
  return letterIndex * 2 + (digit - 1);
}

export function codeFromOrderIndex(index: number): string {
  const letter = String.fromCharCode(65 + Math.floor(index / 2));
  const digit = (index % 2) + 1;
  return `${letter}${digit}`;
}

export function exerciseNotes(ex: ProgramExercise): string {
  return JSON.stringify({
    tempo: ex.tempo,
    pct1RM: ex.pct1RM,
    // Phase 28D safety markers (optional — omitted unless set)
    ...(ex.isSubstituted ? { isSubstituted: true } : {}),
    ...(ex.safetyNote ? { safetyNote: ex.safetyNote } : {}),
    // Phase 30C superset group (optional — omitted unless set)
    ...(ex.supersetGroup ? { supersetGroup: ex.supersetGroup } : {}),
  });
}

export function parseExerciseNotes(
  notes: string | null
): { tempo: string; pct1RM: string; isSubstituted?: boolean; safetyNote?: string; supersetGroup?: string } {
  try {
    if (notes) {
      const parsed = JSON.parse(notes) as {
        tempo?: string;
        pct1RM?: string;
        isSubstituted?: boolean;
        safetyNote?: string;
        supersetGroup?: string;
      };
      return {
        tempo: parsed.tempo || "2-0-1-0",
        pct1RM: parsed.pct1RM || "N/A",
        ...(parsed.isSubstituted ? { isSubstituted: true } : {}),
        ...(parsed.safetyNote ? { safetyNote: parsed.safetyNote } : {}),
        ...(parsed.supersetGroup ? { supersetGroup: parsed.supersetGroup } : {}),
      };
    }
  } catch {
    // ignore malformed notes
  }
  return { tempo: "2-0-1-0", pct1RM: "N/A" };
}

export function buildProgramInsert(
  data: ProgramData,
  trainerId: string,
  assignedClientId: string | null
): DbProgramInsert {
  const activePhases = data.phases.filter((p) => p.active);
  const durationWeeks = activePhases.reduce((sum, p) => sum + p.weeks, 0);
  const activeDays = data.split.filter((d) => d.active).length;

  const isAssigned = !!assignedClientId;
  const startDate = isAssigned ? new Date() : null;
  const endDate = startDate
    ? new Date(startDate.getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000)
    : null;

  // Phase 48: the 30A method selection (slug) rides in the phases jsonb —
  // additive key on the first active phase (or the single-phase fallback),
  // no column changes. programDataFromDb restores it losslessly.
  const phasesToWrite = activePhases.length > 0
    ? activePhases.map((p, i) => (i === 0 && data.method ? { ...p, method: data.method } : p))
    : data.method
      ? [{ id: "p1", name: "Program Phase", weeks: durationWeeks || 4, focus: "", color: "#00AEEF", active: true, method: data.method }]
      : [];

  return {
    trainer_id: trainerId,
    client_id: assignedClientId || null,
    name: data.programName || "Untitled Program",
    description: data.description || null,
    duration_weeks: durationWeeks || 4,
    frequency_per_week: activeDays || 1,
    status: isAssigned ? "active" : "draft",
    start_date: startDate ? startDate.toISOString().split("T")[0] : null,
    end_date: endDate ? endDate.toISOString().split("T")[0] : null,
    // Phase 30B: persist the ACTIVE phase structure (all fields) as jsonb
    phases: phasesToWrite.length > 0 ? (phasesToWrite as unknown as Json) : null,
    // Phase 30D: persist progression rules (empty list -> null)
    progression_rules:
      data.progressionRules.length > 0 ? (data.progressionRules as unknown as Json) : null,
  };
}

export function buildWorkoutRows(data: ProgramData): (Omit<DbWorkoutInsert, "program_id"> & { id?: string })[] {
  return data.split
    .filter((d) => d.active)
    .map((d) => ({
      ...(d.dbId ? { id: d.dbId } : {}),
      name: d.workout || "Workout",
      day_of_week: DAY_TO_INDEX[d.day] || 1,
      week_number: 1,
      notes: null,
    }));
}

export function buildExerciseRows(
  exercises: ProgramExercise[]
): (Omit<DbExerciseInsert, "workout_id"> & { id?: string })[] {
  return exercises.map((ex) => ({
    ...(ex.dbId ? { id: ex.dbId } : {}),
    name: ex.name,
    sets: ex.sets || 0,
    reps: ex.reps || "",
    weight_kg: null,
    rest_seconds: restSecondsFromString(ex.rest),
    rpe: null,
    order_index: orderIndexFromCode(ex.code),
    notes: exerciseNotes(ex),
  }));
}

export function defaultProgramData(
  overrides: Partial<ProgramData> = {}
): ProgramData {
  const defaultContext: ClientContext = {
    ageRange: "",
    experience: "",
    bodyType: "",
    availability: "",
    limitations: [],
    otherLimitation: "",
  };
  const defaultPhases: ProgramPhase[] = [
    {
      id: "p1",
      name: "Accumulation",
      weeks: 4,
      focus: "Build work capacity and aerobic base with higher volume",
      color: "#F59E0B",
      active: true,
    },
    {
      id: "p2",
      name: "Intensification",
      weeks: 4,
      focus: "Increase intensity with moderate volume reduction",
      color: "#EF4444",
      active: true,
    },
    {
      id: "p3",
      name: "Realization",
      weeks: 4,
      focus: "Peak intensity with sport-specific demands",
      color: "#22C55E",
      active: true,
    },
  ];
  const defaultSplit: ProgramSplit[] = [
    { day: "Mon", active: true, workout: "Upper — Push Focus" },
    { day: "Tue", active: true, workout: "Lower — Squat Focus" },
    { day: "Wed", active: false, workout: "Rest Day" },
    { day: "Thu", active: true, workout: "Upper — Pull Focus" },
    { day: "Fri", active: true, workout: "Lower — Hinge Focus" },
    { day: "Sat", active: false, workout: "Rest Day" },
    { day: "Sun", active: false, workout: "Rest Day" },
  ];
  const defaultExercises: ProgramExercise[] = [
    { code: "A1", name: "Back Squat", sets: 5, reps: "5", pct1RM: "82.5%", tempo: "3-0-1-0", rest: "3:00" },
    { code: "A2", name: "Bench Press", sets: 5, reps: "5", pct1RM: "82.5%", tempo: "3-0-1-0", rest: "3:00" },
    { code: "B1", name: "Romanian Deadlift", sets: 4, reps: "8", pct1RM: "75%", tempo: "3-1-1-0", rest: "2:30" },
  ];

  return {
    goal: "",
    method: "",
    clientContext: defaultContext,
    phases: defaultPhases,
    weeklyHours: 4.5,
    split: defaultSplit,
    exercises: defaultExercises,
    progressionRules: [],
    programName: "",
    description: "",
    tags: [],
    isPublic: false,
    assignedClient: "",
    ...overrides,
  };
}

export function programDataFromDb(
  program: ProgramRow,
  workouts: WorkoutRow[],
  exercises: ExerciseRow[]
): ProgramData {
  const defaultData = defaultProgramData();

  const split: ProgramSplit[] = INDEX_TO_DAY.slice(1).map((day) => {
    const workout = workouts.find((w) => w.day_of_week === DAY_TO_INDEX[day]);
    return {
      day,
      active: !!workout,
      workout: workout?.name || "Rest Day",
      ...(workout ? { dbId: workout.id } : {}),
    };
  });

  // Lossless: every workout day keeps its own exercise list (keyed by
  // day_of_week), each exercise carrying its DB id for diff-based saves.
  const toProgramExercise = (ex: ExerciseRow, normalizedCode?: string): ProgramExercise => {
    const extra = parseExerciseNotes(ex.notes);
    const code = normalizedCode ?? codeFromOrderIndex(ex.order_index);
    return {
      code,
      name: ex.name,
      sets: ex.sets || 0,
      reps: ex.reps || "",
      pct1RM: extra.pct1RM,
      tempo: extra.tempo,
      rest: restStringFromSeconds(ex.rest_seconds || 60),
      dbId: ex.id,
      ...(extra.isSubstituted ? { isSubstituted: true } : {}),
      ...(extra.safetyNote ? { safetyNote: extra.safetyNote } : {}),
      // Phase 30C: stored group wins; fall back to the order-code letter
      supersetGroup: extra.supersetGroup ?? code.charAt(0),
    };
  };

  const workoutExercises: Record<number, ProgramExercise[]> = {};
  for (const w of workouts) {
    const dayIdx = w.day_of_week ?? 1;
    const dayRows = exercises
      .filter((e) => e.workout_id === w.id)
      .sort((a, b) => a.order_index - b.order_index);
    // Phase 36: normalize display labels per day (D1 D1 → D1 D2) — display only
    const dayLabels = normalizeOrderLabels(dayRows.map((e) => codeFromOrderIndex(e.order_index)));
    const list = dayRows.map((e, i) => toProgramExercise(e, dayLabels[i]));
    if (list.length > 0) workoutExercises[dayIdx] = list;
  }

  // `exercises` mirrors the first non-empty day's list (kept for shared-list
  // consumers like summary stats); per-day lists are the source of truth.
  const programExercises: ProgramExercise[] =
    Object.values(workoutExercises)[0] || defaultData.exercises;

  // Phase 30B: restore the full phase structure when persisted (jsonb array);
  // fall back to the legacy single-phase shape derived from duration_weeks.
  const storedPhases = Array.isArray(program.phases)
    ? (program.phases as unknown[]).filter(
        (p): p is ProgramData["phases"][number] =>
          typeof p === "object" && p !== null &&
          typeof (p as Record<string, unknown>).id === "string" &&
          typeof (p as Record<string, unknown>).name === "string" &&
          typeof (p as Record<string, unknown>).weeks === "number"
      )
    : [];

  // Phase 30D: restore progression rules when persisted; fallback [].
  const storedRules = Array.isArray(program.progression_rules)
    ? (program.progression_rules as unknown[]).filter(
        (r): r is ProgramData["progressionRules"][number] =>
          typeof r === "object" && r !== null &&
          typeof (r as Record<string, unknown>).label === "string" &&
          typeof (r as Record<string, unknown>).text === "string"
      )
    : [];

  return {
    ...defaultData,
    id: program.id,
    programName: program.name || "",
    description: program.description || "",
    assignedClient: program.client_id || "",
    isPublic: false,
    tags: [],
    progressionRules: storedRules,
    // Phase 48: restore the method tag persisted in the first phase (additive)
    method:
      storedPhases.length > 0 &&
      typeof (storedPhases[0] as { method?: unknown }).method === "string"
        ? ((storedPhases[0] as { method?: unknown }).method as string)
        : "",
    phases: storedPhases.length > 0
      ? storedPhases
      : [
          {
            id: "p1",
            name: "Program Phase",
            weeks: program.duration_weeks || 4,
            focus: "",
            color: "#00AEEF",
            active: true,
          },
        ],
    split,
    exercises: programExercises,
    workoutExercises,
  };
}

export function ageRangeFromDob(dateOfBirth: string | null): string {
  if (!dateOfBirth) return "";
  const birth = new Date(dateOfBirth);
  if (isNaN(birth.getTime())) return "";
  const age = Math.floor(
    (Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );
  if (age < 18) return "<18";
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 45) return "36-45";
  if (age <= 55) return "46-55";
  return "55+";
}

export function clientContextFromClientFields(fields: {
  date_of_birth?: string | null;
  experience_level?: string | null;
}): Partial<ClientContext> {
  const ctx: Partial<ClientContext> = {};
  const ageRange = ageRangeFromDob(fields.date_of_birth || null);
  if (ageRange) ctx.ageRange = ageRange;
  if (fields.experience_level) {
    const map: Record<string, string> = {
      beginner: "<1 year",
      intermediate: "1-3 years",
      advanced: "5-10 years",
    };
    ctx.experience = map[fields.experience_level] || fields.experience_level;
  }
  return ctx;
}
