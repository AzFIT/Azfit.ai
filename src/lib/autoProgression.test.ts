import { describe, it, expect } from "vitest";
import {
  parseRepRange,
  roundToPlateau,
  progressionSuggestion,
  sessionsByExercise,
  NO_SUGGESTION,
  type LoggedSet,
} from "./autoProgression";

const sets = (w: number, reps: number[]): LoggedSet[] => reps.map((reps) => ({ weight: w, reps }));
const base = { prescribedSets: 3, repRangeMin: 8, repRangeMax: 10 };

describe("parseRepRange", () => {
  it("ranges, en-dashes, singles, junk", () => {
    expect(parseRepRange("8-10")).toEqual({ min: 8, max: 10 });
    expect(parseRepRange("8–10")).toEqual({ min: 8, max: 10 });
    expect(parseRepRange("10")).toEqual({ min: 10, max: 10 });
    expect(parseRepRange("12-15")).toEqual({ min: 12, max: 15 });
    expect(parseRepRange("AMRAP")).toEqual({ min: 0, max: 0 });
    expect(parseRepRange("")).toEqual({ min: 0, max: 0 });
  });
});

describe("roundToPlateau", () => {
  it("nearest 2.5 with a 2.5 floor", () => {
    expect(roundToPlateau(61)).toBe(60);
    expect(roundToPlateau(62.4)).toBe(62.5);
    expect(roundToPlateau(63.75)).toBe(65);
    expect(roundToPlateau(1)).toBe(2.5);
    expect(roundToPlateau(0)).toBe(2.5);
  });
});

describe("progressionSuggestion", () => {
  it("INCREASE: all prescribed sets at the top at one weight (< 40 → +2.5)", () => {
    const out = progressionSuggestion({ ...base, history: [sets(35, [10, 10, 10])] });
    expect(out).toMatchObject({ action: "increase", suggestedWeight: 37.5 });
    expect(out.reason).toContain("add 2.5 kg");
  });

  it("INCREASE: ≥ 40 kg working weight → +5 kg", () => {
    const out = progressionSuggestion({ ...base, history: [sets(60, [10, 10, 10])] });
    expect(out.suggestedWeight).toBe(65);
    expect(out.reason).toContain("add 5 kg");
  });

  it("INCREASE rounds to the nearest 2.5 boundary", () => {
    expect(progressionSuggestion({ ...base, history: [sets(62.5, [10, 10, 10])] }).suggestedWeight).toBe(67.5);
  });

  it("single increment even when BOTH sessions topped out (no compounding)", () => {
    const out = progressionSuggestion({
      ...base,
      history: [sets(65, [10, 10, 10]), sets(60, [10, 10, 10])],
    });
    expect(out.suggestedWeight).toBe(70); // from the NEWEST session's 65, not 60+5+5
  });

  it("NO increase when fewer than prescribedSets logged (prescribedSets mismatch)", () => {
    const out = progressionSuggestion({ ...base, history: [sets(60, [10, 10])] });
    expect(out.action).toBe("hold");
  });

  it("NO increase when weights differ across sets", () => {
    const out = progressionSuggestion({
      ...base,
      history: [[{ weight: 60, reps: 10 }, { weight: 62.5, reps: 10 }, { weight: 60, reps: 10 }]],
    });
    expect(out.action).toBe("hold");
  });

  it("HOLD: partial top with short reason", () => {
    const out = progressionSuggestion({ ...base, history: [sets(60, [10, 9, 8])] });
    expect(out).toMatchObject({ action: "hold", suggestedWeight: 60 });
    expect(out.reason).toBe("Repeat 60 kg — 1 of 3 sets hit the top of the range");
  });

  it("DECREASE: 2+ sets below the bottom → −5% rounded to 2.5", () => {
    const out = progressionSuggestion({ ...base, history: [sets(60, [6, 7, 9])] });
    expect(out.action).toBe("decrease");
    expect(out.suggestedWeight).toBe(57.5); // 60 × 0.95 = 57
    expect(out.reason).toContain("Missed 8 reps on 2 sets");
  });

  it("no decrease on a single missed set", () => {
    expect(progressionSuggestion({ ...base, history: [sets(60, [6, 9, 9])] }).action).toBe("hold");
  });

  it("decrease never suggests ≤ 0 or above the working weight", () => {
    const tiny = progressionSuggestion({ ...base, repRangeMin: 8, history: [sets(2.5, [4, 4, 4])] });
    expect(tiny.action).not.toBe("decrease");
  });

  it("NULL: no history, empty session, zero weights, bad range", () => {
    expect(progressionSuggestion({ ...base, history: [] })).toEqual(NO_SUGGESTION);
    expect(progressionSuggestion({ ...base, history: [[]] })).toEqual(NO_SUGGESTION);
    expect(progressionSuggestion({ ...base, history: [sets(0, [0, 0, 0])] })).toEqual(NO_SUGGESTION);
    expect(progressionSuggestion({ ...base, repRangeMax: 0, history: [sets(60, [10, 10, 10])] })).toEqual(NO_SUGGESTION);
  });

  it("uses only the NEWEST session for the verdict (older session ignored)", () => {
    const out = progressionSuggestion({
      ...base,
      history: [sets(60, [9, 9, 9]), sets(62.5, [10, 10, 10])],
    });
    expect(out.action).toBe("hold"); // newest is partial — no increase
  });
});

describe("sessionsByExercise", () => {
  const rows = [
    { exercise_name: "Back Squat", workout_log_id: "log-new", weight_per_set: [60, 60, 60], reps_per_set: [10, 10, 10] },
    { exercise_name: "Back Squat", workout_log_id: "log-old", weight_per_set: [57.5, 57.5, 57.5], reps_per_set: [10, 10, 9] },
    { exercise_name: "Bench Press", workout_log_id: "log-old", weight_per_set: [40, 40], reps_per_set: [8, 8] },
    { exercise_name: "Plank", workout_log_id: "log-old", weight_per_set: [0, 0], reps_per_set: [0, 0] }, // zero sets → skipped
  ];
  it("groups per exercise, newest-first, max 2 sessions", () => {
    const m = sessionsByExercise(rows, ["log-new", "log-old"]);
    expect(m.get("Back Squat")).toHaveLength(2);
    expect(m.get("Back Squat")![0][0]).toEqual({ weight: 60, reps: 10 });
    expect(m.get("Back Squat")![1][0]).toEqual({ weight: 57.5, reps: 10 });
    expect(m.get("Bench Press")).toHaveLength(1);
    expect(m.has("Plank")).toBe(false);
  });
  it("end-to-end with the engine (increase from grouped history)", () => {
    const m = sessionsByExercise(rows, ["log-new", "log-old"]);
    const out = progressionSuggestion({ ...base, history: m.get("Back Squat")! });
    expect(out).toMatchObject({ action: "increase", suggestedWeight: 65 });
  });
});
