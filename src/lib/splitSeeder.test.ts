import { describe, it, expect } from "vitest";
import {
  seedExercisesForDay,
  seedExercisesForSplit,
  reconcileWorkoutExercises,
  preserveSplitIds,
  slotsForDayLabel,
  SEEDED_EXERCISES_PER_DAY,
  type SeededExercise,
} from "./splitSeeder";
import { getExercisesByCategory } from "@/data/exerciseDatabase";
import type { SplitDayLike } from "./wizardSplit";

const KEY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const dayKey = (d: string) => KEY[d] ?? 0;

const PPL: SplitDayLike[] = [
  { day: "Mon", active: true, workout: "Push — Chest/Shoulders/Tris" },
  { day: "Tue", active: true, workout: "Pull — Back/Biceps" },
  { day: "Wed", active: true, workout: "Legs — Quads/Hams/Calves" },
  { day: "Thu", active: false, workout: "Rest Day" },
  { day: "Fri", active: true, workout: "Push — Chest/Shoulders/Tris" },
  { day: "Sat", active: true, workout: "Pull — Back/Biceps" },
  { day: "Sun", active: true, workout: "Legs — Quads/Hams/Calves" },
];

const UPPER_LOWER: SplitDayLike[] = [
  { day: "Mon", active: true, workout: "Upper — Push Focus" },
  { day: "Tue", active: true, workout: "Lower — Squat Focus" },
  { day: "Wed", active: false, workout: "Rest Day" },
  { day: "Thu", active: true, workout: "Upper — Pull Focus" },
  { day: "Fri", active: true, workout: "Lower — Hinge Focus" },
  { day: "Sat", active: false, workout: "Rest Day" },
  { day: "Sun", active: false, workout: "Rest Day" },
];

const seedForDay = (label: string, used: Set<string>) => seedExercisesForDay(label, { used });
const poolFor = (label: string) => new Set(slotsForDayLabel(label).flatMap((c) => getExercisesByCategory(c)));

describe("seedExercisesForDay — pattern-correct by construction", () => {
  it("seeds a full Push day from push-pattern pools only (no rows/deadlifts)", () => {
    const day = seedExercisesForDay("Push — Chest/Shoulders/Tris");
    expect(day).toHaveLength(SEEDED_EXERCISES_PER_DAY);
    const allowed = poolFor("Push — Chest/Shoulders/Tris");
    for (const e of day) expect(allowed.has(e.name)).toBe(true);
    // series codes + the Phase 48 fallback prescription
    expect(day.map((e) => e.code)).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
    expect(day[0]).toMatchObject({ sets: 3, reps: "10", tempo: "2-0-1-0", rest: "2:00" });
  });

  it("Upper labels beat their push/pull suffix; unknown labels get the full-body mix", () => {
    expect(slotsForDayLabel("Upper — Push Focus")).toContain("pulling");
    expect(slotsForDayLabel("Lower — Hinge Focus")).toContain("bilateral_quad");
    expect(slotsForDayLabel("Workout A")).toContain("posterior");
    expect(slotsForDayLabel("Back Day")).not.toContain("pressing");
  });

  it("is deterministic — same label, same lineup", () => {
    expect(seedExercisesForDay("Pull — Back/Biceps")).toEqual(seedExercisesForDay("Pull — Back/Biceps"));
  });

  it("threads the used-set so a repeated label gets DIFFERENT exercises", () => {
    const used = new Set<string>();
    const first = seedExercisesForDay("Push — Chest/Shoulders/Tris", { used });
    const second = seedExercisesForDay("Push — Chest/Shoulders/Tris", { used });
    expect(second.map((e) => e.name)).not.toEqual(first.map((e) => e.name));
    expect(new Set([...first, ...second].map((e) => e.name)).size).toBe(first.length + second.length);
  });
});

describe("seedExercisesForSplit", () => {
  it("seeds every active PPL day with distinct content per repeat day", () => {
    const map = seedExercisesForSplit(PPL, dayKey);
    expect(Object.keys(map).map(Number).sort()).toEqual([1, 2, 3, 5, 6, 7]);
    expect(map[4]).toBeUndefined(); // rest day has no list
    expect(map[5].map((e) => e.name)).not.toEqual(map[1].map((e) => e.name)); // Push A ≠ Push B
  });
});

describe("reconcileWorkoutExercises — the split-sync primitive", () => {
  it("replaces the old split's lists entirely on a split-type change (no stale content)", () => {
    const prevMap: Record<number, SeededExercise[]> = { 1: [{ code: "A1", name: "Barbell Row", sets: 4, reps: "8", pct1RM: "75%", tempo: "3-1-1-0", rest: "2:30" }] };
    const next = reconcileWorkoutExercises(UPPER_LOWER, PPL, prevMap, dayKey, seedForDay);
    expect(Object.keys(next).map(Number).sort()).toEqual([1, 2, 3, 5, 6, 7]);
    // Mon is now a Push day — the stale pull exercise is gone
    expect(next[1].some((e) => e.name === "Barbell Row")).toBe(false);
    const pushPool = poolFor("Push — Chest/Shoulders/Tris");
    for (const e of next[1]) expect(pushPool.has(e.name)).toBe(true);
  });

  it("keeps the SAME list reference for a weekday whose label is unchanged (edits + dbIds survive)", () => {
    const prevMap: Record<number, SeededExercise[]> = {
      1: [{ code: "A1", name: "Trainer Edited Press", sets: 5, reps: "5", pct1RM: "80%", tempo: "3-0-1-0", rest: "3:00" }],
    };
    const sameSplit = UPPER_LOWER.map((d) => ({ ...d }));
    const next = reconcileWorkoutExercises(UPPER_LOWER, sameSplit, prevMap, dayKey, seedForDay);
    expect(next[1]).toBe(prevMap[1]); // reference identity — untouched
    expect(Object.keys(next).map(Number).sort()).toEqual([1, 2, 4, 5]);
  });

  it("prunes the list of a toggled-off day and reseeds on reactivation", () => {
    const prevMap: Record<number, SeededExercise[]> = {
      2: [{ code: "A1", name: "Trainer Edited Squat", sets: 5, reps: "5", pct1RM: "80%", tempo: "3-0-1-0", rest: "3:00" }],
    };
    const offSplit = UPPER_LOWER.map((d, i) => (i === 1 ? { ...d, active: false } : { ...d }));
    const pruned = reconcileWorkoutExercises(UPPER_LOWER, offSplit, prevMap, dayKey, seedForDay);
    expect(pruned[2]).toBeUndefined();
    const backOn = reconcileWorkoutExercises(offSplit, UPPER_LOWER.map((d) => ({ ...d })), pruned, dayKey, seedForDay);
    expect(backOn[2]).toBeDefined();
    expect(backOn[2].some((e) => e.name === "Trainer Edited Squat")).toBe(false); // fresh seed, documented behavior
  });

  it("works with no previous map (fresh wizard path)", () => {
    const next = reconcileWorkoutExercises([], UPPER_LOWER.map((d) => ({ ...d })), undefined, dayKey, seedForDay);
    expect(Object.keys(next).map(Number).sort()).toEqual([1, 2, 4, 5]);
  });
});

describe("preserveSplitIds — workout-row identity", () => {
  it("carries dbId only where weekday + active + label all match", () => {
    const prev = UPPER_LOWER.map((d, i) => ({ ...d, dbId: `w-${i}` }));
    const same = UPPER_LOWER.map((d) => ({ ...d }));
    const kept = preserveSplitIds(prev, same);
    expect(kept.map((d) => d.dbId)).toEqual(["w-0", "w-1", "w-2", "w-3", "w-4", "w-5", "w-6"]);
    const changed = preserveSplitIds(prev, PPL.map((d) => ({ ...d })));
    expect(changed.every((d) => d.dbId === undefined)).toBe(true); // PPL labels differ → no false carries
  });
});

describe("day label precedence — 65B audit catch", () => {
  it("'Full Body N — <focus>' seeds from the full-body mix, not a single pattern", () => {
    const slots = slotsForDayLabel("Full Body 2 — Push + Legs");
    expect(slots).toContain("pulling");
    expect(slots).toContain("pressing");
    expect(slots).toContain("bilateral_quad");
    const day = seedExercisesForDay("Full Body 1 — Pull + Legs");
    expect(day).toHaveLength(SEEDED_EXERCISES_PER_DAY);
  });
});
