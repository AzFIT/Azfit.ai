import { describe, it, expect } from "vitest";
import {
  buildProgramInsert,
  buildWorkoutRows,
  buildExerciseRows,
  programDataFromDb,
  restSecondsFromString,
  orderIndexFromCode,
  codeFromOrderIndex,
  defaultProgramData,
} from "@/lib/aiProgramMapper";

describe("aiProgramMapper", () => {
  const baseData = defaultProgramData({
    programName: "12-Week Strength",
    description: "Test program",
    assignedClient: "",
  });

  it("builds a draft program insert when no client is assigned", () => {
    const insert = buildProgramInsert(baseData, "trainer-uuid", null);
    expect(insert.status).toBe("draft");
    expect(insert.client_id).toBeNull();
    expect(insert.start_date).toBeNull();
    expect(insert.end_date).toBeNull();
    expect(insert.trainer_id).toBe("trainer-uuid");
    expect(insert.name).toBe("12-Week Strength");
  });

  it("builds an active program insert when a client is assigned", () => {
    const insert = buildProgramInsert(baseData, "trainer-uuid", "client-uuid");
    expect(insert.status).toBe("active");
    expect(insert.client_id).toBe("client-uuid");
    expect(insert.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(insert.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 12 weeks from today
    const start = new Date(insert.start_date!);
    const end = new Date(insert.end_date!);
    const diffWeeks = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7);
    expect(Math.round(diffWeeks)).toBe(12);
  });

  it("computes duration_weeks from active phases and frequency from active split days", () => {
    const insert = buildProgramInsert(baseData, "trainer-uuid", null);
    expect(insert.duration_weeks).toBe(12);
    expect(insert.frequency_per_week).toBe(4);
  });

  it("builds workouts with day_of_week 1-7 for active split days", () => {
    const workouts = buildWorkoutRows(baseData);
    expect(workouts).toHaveLength(4);
    expect(workouts.map((w) => w.day_of_week)).toEqual([1, 2, 4, 5]);
    expect(workouts.every((w) => w.week_number === 1)).toBe(true);
    expect(workouts[0].name).toBe("Upper — Push Focus");
  });

  it("maps exercise order codes to numeric order_index", () => {
    const exercises = buildExerciseRows(baseData.exercises);
    expect(exercises).toHaveLength(3);
    expect(exercises[0].order_index).toBe(orderIndexFromCode("A1"));
    expect(exercises[1].order_index).toBe(orderIndexFromCode("A2"));
    expect(exercises[2].order_index).toBe(orderIndexFromCode("B1"));
    expect(exercises[0].order_index).toBe(0);
    expect(exercises[1].order_index).toBe(1);
    expect(exercises[2].order_index).toBe(2);
  });

  it("parses rest strings into seconds", () => {
    expect(restSecondsFromString("3:00")).toBe(180);
    expect(restSecondsFromString("2:30")).toBe(150);
    expect(restSecondsFromString("90")).toBe(90);
    expect(restSecondsFromString("")).toBe(60);
  });

  it("round-trips code <-> order index", () => {
    expect(codeFromOrderIndex(orderIndexFromCode("A1"))).toBe("A1");
    expect(codeFromOrderIndex(orderIndexFromCode("B2"))).toBe("B2");
    expect(codeFromOrderIndex(orderIndexFromCode("C1"))).toBe("C1");
  });

  it("rehydrates ProgramData from DB rows", () => {
    const program = {
      id: "program-uuid",
      trainer_id: "trainer-uuid",
      client_id: "client-uuid",
      name: "Loaded Program",
      description: "Loaded desc",
      duration_weeks: 8,
      frequency_per_week: 3,
      status: "active" as const,
      start_date: "2026-07-22",
      end_date: "2026-09-16",
      created_at: "2026-07-22T00:00:00Z",
      updated_at: "2026-07-22T00:00:00Z",
    };
    const workouts = [
      { id: "w1", program_id: "program-uuid", name: "Day 1", day_of_week: 1, week_number: 1, notes: null, created_at: "2026-07-22T00:00:00Z", updated_at: "2026-07-22T00:00:00Z" },
      { id: "w2", program_id: "program-uuid", name: "Day 2", day_of_week: 3, week_number: 1, notes: null, created_at: "2026-07-22T00:00:00Z", updated_at: "2026-07-22T00:00:00Z" },
    ];
    const exercises = [
      { id: "e1", workout_id: "w1", name: "Squat", sets: 4, reps: "5", weight_kg: null, rest_seconds: 180, rpe: null, order_index: 0, notes: JSON.stringify({ tempo: "2-1-1-0", pct1RM: "82.5%" }), created_at: "2026-07-22T00:00:00Z" },
      { id: "e2", workout_id: "w1", name: "Press", sets: 3, reps: "8", weight_kg: null, rest_seconds: 90, rpe: null, order_index: 1, notes: JSON.stringify({ tempo: "2-0-1-0", pct1RM: "75%" }), created_at: "2026-07-22T00:00:00Z" },
    ];

    const rehydrated = programDataFromDb(program, workouts, exercises);
    expect(rehydrated.id).toBe("program-uuid");
    expect(rehydrated.programName).toBe("Loaded Program");
    expect(rehydrated.description).toBe("Loaded desc");
    expect(rehydrated.assignedClient).toBe("client-uuid");
    expect(rehydrated.phases[0].weeks).toBe(8);
    expect(rehydrated.split.filter((d) => d.active).map((d) => d.day)).toEqual(["Mon", "Wed"]);
    expect(rehydrated.exercises).toHaveLength(2);
    expect(rehydrated.exercises[0].code).toBe("A1");
    expect(rehydrated.exercises[0].name).toBe("Squat");
    expect(rehydrated.exercises[0].tempo).toBe("2-1-1-0");
    expect(rehydrated.exercises[0].pct1RM).toBe("82.5%");
    expect(rehydrated.exercises[0].rest).toBe("3:00");
  });
});
