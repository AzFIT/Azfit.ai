import { describe, it, expect } from "vitest";
import { FULL_BODY_ROTATION, fullBodyWorkoutExercises } from "./fullBodyRotation";

const signature = (day: { name: string; sets: number; reps: string }[]) =>
  day.map((e) => `${e.name}:${e.sets}x${e.reps}`).join("|");

describe("FULL_BODY_ROTATION lineups", () => {
  it("no two days are identical", () => {
    const sigs = FULL_BODY_ROTATION.map(signature);
    expect(new Set(sigs).size).toBe(FULL_BODY_ROTATION.length);
  });

  it("every day squats", () => {
    for (const day of FULL_BODY_ROTATION) {
      expect(day.some((e) => /squat/i.test(e.name))).toBe(true);
    }
  });

  it("bench and overhead press alternate across days", () => {
    const has = (re: RegExp) => FULL_BODY_ROTATION.map((d) => d.some((e) => re.test(e.name)));
    expect(has(/bench press/i)).toEqual([true, false, true]);
    expect(has(/overhead press/i)).toEqual([false, true, false]);
  });

  it("accessories rotate: row on A, deadlift on B, pull-up on C", () => {
    expect(FULL_BODY_ROTATION[0].some((e) => /barbell row/i.test(e.name))).toBe(true);
    expect(FULL_BODY_ROTATION[1].some((e) => e.name === "Deadlift")).toBe(true);
    expect(FULL_BODY_ROTATION[2].some((e) => /pull-up/i.test(e.name))).toBe(true);
  });

  it("every day keeps the A1/A2 pairing + 6 exercises with varied schemes", () => {
    for (const day of FULL_BODY_ROTATION) {
      expect(day).toHaveLength(6);
      expect(day[0].code).toBe("A1");
      expect(day[1].code).toBe("A2");
    }
    const repSchemes = new Set(FULL_BODY_ROTATION.map((d) => d.map((e) => `${e.sets}x${e.reps}`).join(",")));
    expect(repSchemes.size).toBe(FULL_BODY_ROTATION.length);
  });
});

describe("fullBodyWorkoutExercises", () => {
  const dayKey = (d: string) => ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 })[d] ?? 0;

  it("keys the rotation by the split's active day indexes (Mon/Wed/Fri → 1/3/5)", () => {
    const split = [
      { day: "Mon", active: true }, { day: "Tue", active: false }, { day: "Wed", active: true },
      { day: "Thu", active: false }, { day: "Fri", active: true }, { day: "Sat", active: false },
      { day: "Sun", active: false },
    ];
    const out = fullBodyWorkoutExercises(split, dayKey);
    expect(Object.keys(out).map(Number).sort()).toEqual([1, 3, 5]);
    expect(signature(out[1])).not.toBe(signature(out[3]));
    expect(signature(out[3])).not.toBe(signature(out[5]));
    expect(signature(out[1])).not.toBe(signature(out[5]));
  });

  it("cycles the rotation for more than 3 active days", () => {
    const split = ["Mon", "Tue", "Wed", "Thu"].map((day) => ({ day, active: true }));
    const out = fullBodyWorkoutExercises(split, dayKey);
    expect(signature(out[4])).toBe(signature(out[1])); // day 4 = rotation A again
  });

  it("returns an empty map when no days are active", () => {
    expect(fullBodyWorkoutExercises([{ day: "Mon", active: false }], dayKey)).toEqual({});
  });

  it("returns copies — mutating one day's list never leaks into the rotation", () => {
    const out = fullBodyWorkoutExercises([{ day: "Mon", active: true }], dayKey);
    out[1][0].name = "MUTATED";
    expect(FULL_BODY_ROTATION[0][0].name).toBe("Back Squat");
  });
});
