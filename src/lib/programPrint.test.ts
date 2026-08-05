import { describe, it, expect } from "vitest";
import { buildPrintModel, buildPrintModelFromWizard } from "@/lib/programPrint";
import { normalizeOrderLabels } from "@/lib/exerciseLabels";
import { getOrderCode } from "@/lib/workoutSession";
import type { Database } from "@/types/supabase";

type ProgramRow = Database["public"]["Tables"]["programs"]["Row"];
type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];
type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

const program = {
  id: "p1",
  name: "Upper/Lower — Build Muscle",
  client_id: "c1",
  trainer_id: "t1",
  created_at: "2026-07-01T10:00:00Z",
  start_date: "2026-07-06",
  end_date: "2026-08-31",
  phases: [{ id: "ph1", name: "Accumulation", weeks: 4, active: true }],
  progression_rules: [{ id: "double", label: "Double Progression", text: "+2.5kg at top of range" }],
} as unknown as ProgramRow;

const workouts = [
  { id: "w2", program_id: "p1", name: "Lower — Squat Focus", day_of_week: 2 },
  { id: "w1", program_id: "p1", name: "Upper — Push Focus", day_of_week: 1 },
] as unknown as WorkoutRow[];

const exercises = [
  { id: "e2", workout_id: "w1", name: "Bench Press", sets: 4, reps: "8", order_index: 1, rest_seconds: 90, notes: '{"tempo":"2-0-1-0","supersetGroup":"A"}' },
  { id: "e1", workout_id: "w1", name: "Overhead Press", sets: 3, reps: "10", order_index: 0, rest_seconds: 120, notes: '{"tempo":"3-0-1-0","isSubstituted":true}' },
  { id: "e3", workout_id: "w2", name: "Back Squat", sets: 5, reps: "5", order_index: 0, rest_seconds: 180, notes: null },
] as unknown as ExerciseRow[];

describe("buildPrintModel (saved program)", () => {
  const model = buildPrintModel(program, workouts, exercises, "Alex Carter", "Coach Demo");

  it("carries header fields + dates + phases + rules", () => {
    expect(model.title).toBe("Upper/Lower — Build Muscle");
    expect(model.clientName).toBe("Alex Carter");
    expect(model.trainerName).toBe("Coach Demo");
    expect(model.createdDate).toContain("2026");
    expect(model.startDate).toContain("2026");
    expect(model.endDate).toContain("2026");
    expect(model.phaseNames).toEqual(["Accumulation"]);
    expect(model.progressionRules).toEqual([{ label: "Double Progression", text: "+2.5kg at top of range" }]);
  });

  it("orders days by day_of_week and exercises by order_index", () => {
    expect(model.days.map((d) => d.label)).toEqual([
      "Monday — Upper — Push Focus",
      "Tuesday — Lower — Squat Focus",
    ]);
    expect(model.days[0].exercises.map((e) => e.name)).toEqual(["Overhead Press", "Bench Press"]);
  });

  it("normalizes explicit supersetGroup into the day labels (Phase 42 fix)", () => {
    // e1 has order code A1, e2 explicit group A → the pair normalizes to A1/A2
    // (pre-42 print showed the inconsistent A1 + bare A)
    expect(model.days[0].exercises[1].order).toBe("A2");
    expect(model.days[0].exercises[0].order).toBe("A1");
    expect(model.days[0].exercises[1].setsReps).toBe("4 × 8");
    expect(model.days[0].exercises[1].rest).toBe("1:30");
    expect(model.days[0].exercises[0].notes).toContain("Swapped for safety");
  });

  it("omits empty values instead of printing placeholders", () => {
    const squat = model.days[1].exercises[0];
    expect(squat.notes).toEqual([]);
    expect(squat.tempo).toBeNull();
  });

  it("keeps stored tempo when present (28D notes jsonb)", () => {
    expect(model.days[0].exercises[0].tempo).toBe("3-0-1-0");
    expect(model.days[0].exercises[1].tempo).toBe("2-0-1-0");
  });
});

describe("buildPrintModelFromWizard (draft)", () => {
  it("maps in-memory draft with per-day lists and draft title", () => {
    const model = buildPrintModelFromWizard(
      {
        id: undefined,
        goal: "hypertrophy",
        method: "german-volume",
        clientContext: { ageRange: "", experience: "", bodyType: "", availability: "", limitations: [], otherLimitation: "" },
        phases: [{ id: "p1", name: "Accumulation", weeks: 4, focus: "", color: "#F59E0B", active: true }],
        weeklyHours: 4,
        split: [
          { day: "Tue", active: true, workout: "Lower — Squat" },
          { day: "Mon", active: true, workout: "Upper — Push" },
          { day: "Wed", active: false, workout: "Rest Day" },
        ],
        exercises: [{ code: "A1", name: "Back Squat", sets: 5, reps: "5", pct1RM: "82.5%", tempo: "3-0-1-0", rest: "3:00" }],
        progressionRules: [{ label: "Deload Every 4th Week", text: "Week 4: −40% volume" }],
        programName: "",
        description: "",
        tags: [],
        isPublic: false,
        assignedClient: "",
      },
      "Alex Carter",
      "Coach Demo"
    );
    expect(model.title).toBe("Draft Program");
    expect(model.days.map((d) => d.label)).toEqual(["Monday — Upper — Push", "Tuesday — Lower — Squat"]);
    expect(model.days[0].exercises[0].setsReps).toBe("5 × 5");
    expect(model.progressionRules[0].label).toBe("Deload Every 4th Week");
  });
});

describe("Phase 36 — label parity between the session player and the print view", () => {
  it("the same legacy fixture (duplicate order_index) yields identical labels on both paths", () => {
    // Owner's case: 8 rows, the last two sharing order_index 6 → raw D1 D1
    const orderIdx = [0, 1, 2, 3, 4, 5, 6, 6];
    // Session-player path (33C): getOrderCode per row → normalizeOrderLabels
    const sessionPath = normalizeOrderLabels(orderIdx.map(getOrderCode));
    expect(sessionPath).toEqual(["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"]);

    // Print path (Phase 34/36): buildPrintModel normalizes per day
    const w = { id: "w1", program_id: "p1", name: "Full Body A", day_of_week: 1 } as unknown as WorkoutRow;
    const rows = orderIdx.map((oi, i) => ({
      id: `e${i}`,
      workout_id: "w1",
      name: `Exercise ${i + 1}`,
      sets: 3,
      reps: "10",
      order_index: oi,
      rest_seconds: 60,
      notes: null,
    })) as unknown as ExerciseRow[];
    const model = buildPrintModel(
      { id: "p1", name: "T", client_id: "c", trainer_id: "t", created_at: "2026-01-01", start_date: null, end_date: null, phases: null, progression_rules: null } as unknown as ProgramRow,
      [w],
      rows,
      "Client",
      "Coach"
    );
    const printPath = model.days[0].exercises.map((e) => e.order);
    expect(printPath).toEqual(sessionPath);
  });
});

describe("explicit supersetGroup labels in print (Phase 42 follow-up)", () => {
  it("grouped rows print numbered group labels (A1/A2), singletons plain", () => {
    const w = { id: "w1", program_id: "p1", name: "Push", day_of_week: 1 } as unknown as WorkoutRow;
    const mk = (i: number, oi: number, group: string | null) => ({
      id: `e${i}`,
      workout_id: "w1",
      name: `Exercise ${i + 1}`,
      sets: 3,
      reps: "10",
      order_index: oi,
      rest_seconds: 60,
      notes: JSON.stringify(group ? { supersetGroup: group } : {}),
    }) as unknown as ExerciseRow;
    const model = buildPrintModel(
      { id: "p1", name: "T", client_id: "c", trainer_id: "t", created_at: "2026-01-01", start_date: null, end_date: null, phases: null, progression_rules: null } as unknown as ProgramRow,
      [w],
      [mk(0, 0, "A"), mk(1, 1, "A"), mk(2, 2, null)],
      "Client",
      "Coach"
    );
    expect(model.days[0].exercises.map((e) => e.order)).toEqual(["A1", "A2", "B"]);
  });
});
