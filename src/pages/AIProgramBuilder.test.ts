// Phase 29A — generated programs must keep each day's OWN exercise list.
// Regression test for the clone-one-list-across-all-days bug in
// mapGeneratedToProgramData (it used to map only activeWorkouts[0]).
import { describe, it, expect } from "vitest";
import { generateProgram, type ClientProfile } from "@/lib/aiProgramGenerator";
import { mapGeneratedToProgramData } from "@/pages/AIProgramBuilder";

const profile4day: ClientProfile = {
  trainingFrequency: 4,
  trainingExperience: "intermediate",
  primaryGoal: "build_muscle",
  availableEquipment: ["Full Gym"],
  preferredStyle: ["Free Weights"],
  injuries: "",
};

describe("mapGeneratedToProgramData — per-day exercise lists (Phase 29A)", () => {
  const gen = generateProgram(profile4day);
  const data = mapGeneratedToProgramData(gen, profile4day);
  const workouts = gen.phases[0].workouts;

  it("generates a 4-day Upper/Lower program", () => {
    expect(workouts).toHaveLength(4);
    expect(workouts.map((w) => w.name)).toEqual([
      "Upper A",
      "Lower A",
      "Upper B",
      "Lower B",
    ]);
  });

  it("builds workoutExercises keyed by 1-based day index, one list per generated day", () => {
    expect(data.workoutExercises).toBeDefined();
    expect(Object.keys(data.workoutExercises!).map(Number).sort()).toEqual([1, 2, 3, 4]);
  });

  it("each day's list matches THAT generated workout's own exercises", () => {
    workouts.forEach((workout, idx) => {
      const mapped = data.workoutExercises![idx + 1];
      expect(mapped).toBeDefined();
      expect(mapped.map((e) => e.name)).toEqual(workout.exercises.map((e) => e.name));
      // field mapping preserved (order → code, rest seconds → m:ss)
      mapped.forEach((e, i) => {
        expect(e.code).toBe(workout.exercises[i].order);
        expect(e.sets).toBe(workout.exercises[i].sets);
        expect(e.rest).toMatch(/^\d+:\d{2}$/);
      });
    });
  });

  it("day lists are DISTINCT (the old bug cloned one list across all days)", () => {
    const signatures = Object.values(data.workoutExercises!).map((list) =>
      list.map((e) => e.name).join("|")
    );
    expect(new Set(signatures).size).toBe(workouts.length);
  });

  it("shared `exercises` mirrors the first non-empty day's list", () => {
    const firstDay = data.workoutExercises![1];
    expect(data.exercises.map((e) => e.name)).toEqual(firstDay.map((e) => e.name));
    // mirror is a copy, not the same object references
    expect(data.exercises[0]).not.toBe(firstDay[0]);
  });

  it("split days stay aligned: workout idx lands on dayNames[idx] (Mon=1 …)", () => {
    const activeDays = data.split.filter((d) => d.active);
    expect(activeDays.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu"]);
    expect(activeDays[0].workout).toContain(workouts[0].name);
    expect(activeDays[1].workout).toContain(workouts[1].name);
  });
});
