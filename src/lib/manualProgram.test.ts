import { describe, it, expect } from "vitest";
import {
  manualLabels,
  validateManualProgram,
  buildManualProgramInsert,
  buildManualWorkoutRows,
  buildManualExerciseRows,
  type ManualExercise,
  type ManualDay,
} from "@/lib/manualProgram";

const ex = (name: string, over: Partial<ManualExercise> = {}): ManualExercise => ({
  id: Math.random().toString(36).slice(2),
  name,
  sets: "3",
  reps: "8-12",
  tempo: "3-0-1-0",
  group: null,
  ...over,
});

const day = (name: string, exercises: ManualExercise[]): ManualDay => ({
  id: Math.random().toString(36).slice(2),
  name,
  exercises,
});

const TRAINER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";

describe("manualLabels (Phase 42)", () => {
  it("ungrouped sequential exercises fall back to order-code pairs (30C implicit)", () => {
    expect(manualLabels([ex("a"), ex("b"), ex("c"), ex("d")])).toEqual([
      "A1", "A2", "B1", "B2",
    ]);
  });

  it("explicit groups win and number within the group", () => {
    const labels = manualLabels([
      ex("a", { group: "A" }),
      ex("b", { group: "A" }),
      ex("c", { group: "C" }),
    ]);
    expect(labels).toEqual(["A1", "A2", "C"]); // singleton C collapses
  });

  it("mixed explicit + fallback letters normalize together", () => {
    const labels = manualLabels([
      ex("a", { group: "B" }),
      ex("b"), // order-code A
      ex("c", { group: "B" }),
    ]);
    expect(labels).toEqual(["B1", "A", "B2"]);
  });
});

describe("validateManualProgram (Phase 42)", () => {
  it("valid draft passes", () => {
    const errors = validateManualProgram({
      name: "PPL",
      description: "",
      weeks: 4,
      days: [day("Push", [ex("BB Bench Press")])],
    });
    expect(errors).toEqual([]);
  });

  it("name required", () => {
    expect(
      validateManualProgram({ name: " ", description: "", weeks: 4, days: [day("P", [ex("x")])] }),
    ).toContain("Program name is required");
  });

  it("zero days and empty days are both caught", () => {
    expect(
      validateManualProgram({ name: "P", description: "", weeks: 4, days: [] }),
    ).toContain("Add at least one day");
    const errs = validateManualProgram({ name: "P", description: "", weeks: 4, days: [day("Push", [])] });
    expect(errs.some((e) => e.includes("add at least one exercise"))).toBe(true);
  });

  it("sets/reps validated per exercise with day context", () => {
    const errs = validateManualProgram({
      name: "P",
      description: "",
      weeks: 4,
      days: [day("Push", [ex("Squat", { sets: "0" }), ex("Bench", { reps: " " })])],
    });
    expect(errs.some((e) => e.includes("Squat") && e.includes("sets"))).toBe(true);
    expect(errs.some((e) => e.includes("Bench") && e.includes("reps"))).toBe(true);
  });

  it("weeks bounded 1–12", () => {
    expect(
      validateManualProgram({ name: "P", description: "", weeks: 13, days: [day("P", [ex("x")])] }),
    ).toContain("Duration must be 1–12 weeks");
  });
});

describe("save mapping — aiProgramMapper-identical shape (Phase 42)", () => {
  const draft = {
    name: "  Upper/Lower  ",
    description: "  ",
    weeks: 6,
    days: [
      day("Push", [ex("BB Bench Press", { sets: "4", reps: "6-8", group: "A" }), ex("BB Overhead Press", { group: "A" })]),
      day("Pull", [ex("Lat Pulldown")]),
    ],
  };

  it("programs insert: active, assigned, dates, derived frequency, null extras", () => {
    const row = buildManualProgramInsert(draft, TRAINER, CLIENT, "2026-08-05");
    expect(row).toMatchObject({
      trainer_id: TRAINER,
      client_id: CLIENT,
      name: "Upper/Lower", // trimmed
      description: null, // empty stays null (honest)
      duration_weeks: 6,
      frequency_per_week: 2, // derived from days
      status: "active",
      start_date: "2026-08-05",
      end_date: "2026-09-16", // +6 weeks
      phases: null,
      progression_rules: null,
    });
  });

  it("workout rows: sequential day_of_week, week 1, null notes", () => {
    expect(buildManualWorkoutRows(draft.days)).toEqual([
      { name: "Push", day_of_week: 1, week_number: 1, notes: null },
      { name: "Pull", day_of_week: 2, week_number: 1, notes: null },
    ]);
  });

  it("exercise rows: sequential order_index + mapper-identical notes JSON", () => {
    const rows = buildManualExerciseRows(draft.days[0].exercises);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "BB Bench Press",
      sets: 4,
      reps: "6-8",
      weight_kg: null,
      rest_seconds: 60,
      rpe: null,
      order_index: 0,
    });
    const n0 = JSON.parse(rows[0].notes!);
    expect(n0).toEqual({ tempo: "3-0-1-0", pct1RM: "N/A", supersetGroup: "A" });
    expect(rows[1].order_index).toBe(1);
  });

  it("empty tempo is omitted from notes (no fabricated defaults)", () => {
    const rows = buildManualExerciseRows([ex("Squat", { tempo: " " })]);
    const n = JSON.parse(rows[0].notes!);
    expect(n).toEqual({ pct1RM: "N/A" });
    expect("tempo" in n).toBe(false);
  });
});
