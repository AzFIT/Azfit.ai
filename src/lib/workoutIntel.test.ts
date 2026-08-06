import { describe, it, expect } from "vitest";
import {
  latestGhostByExercise,
  ghostText,
  parseRestSeconds,
  waveProgress,
  highVolumeSets,
} from "@/lib/workoutIntel";

describe("latestGhostByExercise (Phase 49)", () => {
  it("picks the newest row per exercise and its last non-zero set", () => {
    const rows = [
      { exercise_name: "Squat", weight_per_set: [22.5, 22.5], reps_per_set: [10, 10], rpe_per_set: [8, 8] },
      { exercise_name: "Squat", weight_per_set: [20, 20], reps_per_set: [8, 8], rpe_per_set: [7, 7] }, // older
      { exercise_name: "Bench", weight_per_set: [40], reps_per_set: [6], rpe_per_set: [9] },
    ];
    const map = latestGhostByExercise(rows);
    expect(map.get("Squat")).toEqual({ weight: 22.5, reps: 10, rpe: 8 });
    expect(map.get("Bench")).toEqual({ weight: 40, reps: 6, rpe: 9 });
  });

  it("skips trailing zero (undone) sets when picking the last set", () => {
    const rows = [
      { exercise_name: "Squat", weight_per_set: [50, 0], reps_per_set: [5, 0], rpe_per_set: [8, 0] },
    ];
    expect(latestGhostByExercise(rows).get("Squat")).toEqual({ weight: 50, reps: 5, rpe: 8 });
  });

  it("omits null fields; exercises with no history are absent", () => {
    const rows = [
      { exercise_name: "Plank", weight_per_set: [0], reps_per_set: [0], rpe_per_set: [30] },
    ];
    const map = latestGhostByExercise(rows);
    expect(map.get("Plank")).toEqual({ rpe: 30 });
    expect(map.has("Missing")).toBe(false);
  });
});

describe("ghostText (Phase 49)", () => {
  it("renders only present fields", () => {
    expect(ghostText({ weight: 22.5, reps: 10, rpe: 8 })).toBe("Last: 22.5 kg × 10 @ RPE 8");
    expect(ghostText({ weight: 60, reps: 5 })).toBe("Last: 60 kg × 5");
    expect(ghostText({})).toBeNull();
    expect(ghostText(undefined)).toBeNull();
  });
});

describe("parseRestSeconds (Phase 49)", () => {
  it("ranges take the midpoint; singles parse; unparseable → null", () => {
    expect(parseRestSeconds("60–90s")).toBe(75);
    expect(parseRestSeconds("2–3 min")).toBe(150);
    expect(parseRestSeconds("10s")).toBe(10);
    expect(parseRestSeconds("10–15s intra-set · 2–3 min between")).toBe(13); // first range
    expect(parseRestSeconds("Minimal — race the clock")).toBeNull();
    expect(parseRestSeconds("Variable")).toBeNull();
  });
});

describe("waveProgress (Phase 49)", () => {
  it("maps completed sets to the wave index (3 sets per wave)", () => {
    const setsReps = "3/2/1 × 3–4 waves";
    expect(waveProgress(setsReps, 0)).toEqual({ wave: 1, maxWaves: 4 });
    expect(waveProgress(setsReps, 3)).toEqual({ wave: 2, maxWaves: 4 });
    expect(waveProgress(setsReps, 6)).toEqual({ wave: 3, maxWaves: 4 });
    expect(waveProgress(setsReps, 12)).toEqual({ wave: 4, maxWaves: 4 }); // capped
  });

  it("returns null for non-wave patterns", () => {
    expect(waveProgress("10×10", 5)).toBeNull();
    expect(waveProgress("4–6 × 8–12", 0)).toBeNull();
  });
});

describe("highVolumeSets (Phase 49)", () => {
  it("fires only for 8+ set prescriptions", () => {
    expect(highVolumeSets("10×10")).toBe(10);
    expect(highVolumeSets("8×8")).toBe(8);
    expect(highVolumeSets("5×5")).toBeNull();
    expect(highVolumeSets("4–6 × 8–12")).toBeNull();
  });
});
