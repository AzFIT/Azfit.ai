import { describe, it, expect } from "vitest";
import { swapSplitContent } from "./wizardSplit";

const KEY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const dayKey = (d: string) => KEY[d] ?? 0;

const split = [
  { day: "Mon", active: true, workout: "Upper A", dbId: "w-mon" },
  { day: "Tue", active: true, workout: "Lower A", dbId: "w-tue" },
  { day: "Wed", active: false, workout: "", dbId: undefined },
  { day: "Thu", active: true, workout: "Upper B", dbId: "w-thu" },
];

describe("swapSplitContent (Step 5 drag-to-swap)", () => {
  it("swaps content between two workout days; day labels + positions stay fixed", () => {
    const we = { 1: ["squat"], 2: ["deadlift"], 4: ["bench"] };
    const r = swapSplitContent(split, we, 0, 3, dayKey);
    expect(r.split.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu"]);
    expect(r.split[0]).toMatchObject({ day: "Mon", active: true, workout: "Upper B", dbId: "w-thu" });
    expect(r.split[3]).toMatchObject({ day: "Thu", active: true, workout: "Upper A", dbId: "w-mon" });
    expect(r.split[1]).toMatchObject({ workout: "Lower A" }); // untouched
    // exercise lists follow their content
    expect(r.workoutExercises).toEqual({ 1: ["bench"], 2: ["deadlift"], 4: ["squat"] });
  });

  it("dragging a workout onto a rest day makes the source a rest day", () => {
    const we = { 1: ["squat"], 2: ["deadlift"], 4: ["bench"] };
    const r = swapSplitContent(split, we, 0, 2, dayKey); // Mon workout ↔ Wed rest
    expect(r.split[0]).toMatchObject({ day: "Mon", active: false, workout: "" });
    expect(r.split[2]).toMatchObject({ day: "Wed", active: true, workout: "Upper A", dbId: "w-mon" });
    expect(r.workoutExercises?.[1]).toBeUndefined();
    expect(r.workoutExercises?.[3]).toEqual(["squat"]);
  });

  it("same-index / out-of-range drops are no-ops (identity)", () => {
    const r = swapSplitContent(split, undefined, 0, 0, dayKey);
    expect(r.split).toBe(split);
    expect(swapSplitContent(split, undefined, 0, 9, dayKey).split).toBe(split);
  });

  it("works without workoutExercises (shared-list mode)", () => {
    const r = swapSplitContent(split, undefined, 0, 3, dayKey);
    expect(r.split[0].workout).toBe("Upper B");
    expect(r.workoutExercises).toBeUndefined();
  });
});
