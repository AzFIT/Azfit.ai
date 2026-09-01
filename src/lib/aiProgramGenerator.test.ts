// Phase 29B — every generated training day must have >= MIN_EXERCISES_PER_DAY.
import { describe, it, expect } from "vitest";
import {
  generateProgram,
  MIN_EXERCISES_PER_DAY,
  type ClientProfile,
} from "@/lib/aiProgramGenerator";
import { findContraindications } from "@/data/exerciseSafety";

const base: ClientProfile = {
  trainingFrequency: 4,
  trainingExperience: "intermediate",
  primaryGoal: "build_muscle",
  availableEquipment: ["Full Gym"],
  preferredStyle: ["Free Weights"],
  injuries: "",
};

describe("generateProgram — minimum exercises per day (Phase 29B)", () => {
  it("(a) constrained profile (Bodyweight Only + beginner) still yields >=8 on every day", () => {
    const gen = generateProgram({
      ...base,
      trainingExperience: "beginner",
      availableEquipment: ["Bodyweight Only"],
    });
    for (const w of gen.phases[0].workouts) {
      expect(w.exercises.length).toBeGreaterThanOrEqual(MIN_EXERCISES_PER_DAY);
    }
  });

  it("(a2) constrained 3-day profile also fills every day", () => {
    const gen = generateProgram({
      ...base,
      trainingFrequency: 3,
      trainingExperience: "beginner",
      availableEquipment: ["Bodyweight Only"],
    });
    expect(gen.phases[0].workouts).toHaveLength(3);
    for (const w of gen.phases[0].workouts) {
      expect(w.exercises.length).toBeGreaterThanOrEqual(MIN_EXERCISES_PER_DAY);
    }
  });

  it("(b) Full Gym profile yields exactly the slot count with zero cross-day repeats", () => {
    const gen = generateProgram(base);
    const seen = new Set<string>();
    for (const w of gen.phases[0].workouts) {
      expect(w.exercises.length).toBe(8); // exactly the slot count when pools allow
      for (const e of w.exercises) {
        expect(seen.has(e.name)).toBe(false);
        seen.add(e.name);
      }
    }
  });

  it("(c) safety-excluded exercises never reappear after top-up", () => {
    const gen = generateProgram({ ...base, injuries: "lower back" });
    for (const w of gen.phases[0].workouts) {
      expect(w.exercises.length).toBeGreaterThanOrEqual(MIN_EXERCISES_PER_DAY);
      for (const e of w.exercises) {
        const hits = findContraindications(e.name, ["Lower back pain"]);
        expect(hits.some((h) => h.severity === "exclude")).toBe(false);
        expect(e.name.toLowerCase()).not.toContain("deadlift");
      }
    }
  });

  it("top-up order prefixes start past the slot range (no A/B/C/D collisions)", () => {
    const gen = generateProgram({
      ...base,
      trainingExperience: "beginner",
      availableEquipment: ["Bodyweight Only"],
    });
    for (const w of gen.phases[0].workouts) {
      const orders = w.exercises.map((e) => e.order);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });
});

// Phase 65A — a full day is never bought with a pattern violation, and a
// name never repeats within one day. The old whole-pool top-up stage put
// pulls/hinges on Push days; the old reuse fallback could same-day a name.
import { getSplitConfig } from "@/lib/aiProgramGenerator";
import { EXERCISE_CATEGORIES } from "@/data/exerciseDatabase";

const labelFor = (cid: string) => EXERCISE_CATEGORIES.find((c) => c.id === cid)?.label ?? cid;

describe("generateProgram — Phase 65A pattern purity + no same-day repeats", () => {
  it("every generated exercise stays inside its day's slot categories (freq 2-6)", () => {
    for (let freq = 2; freq <= 6; freq++) {
      const gen = generateProgram({ ...base, trainingFrequency: freq });
      const config = getSplitConfig(freq);
      gen.phases[0].workouts.forEach((w, i) => {
        const allowed = new Set(config.days[i].slotCategories.map(labelFor));
        for (const e of w.exercises) expect(allowed.has(e.category)).toBe(true);
      });
    }
  });

  it("pattern purity + MIN hold under pool exhaustion (Bodyweight Only + beginner, 6 days)", () => {
    const gen = generateProgram({
      ...base,
      trainingFrequency: 6,
      trainingExperience: "beginner",
      availableEquipment: ["Bodyweight Only"],
    });
    const config = getSplitConfig(6);
    gen.phases[0].workouts.forEach((w, i) => {
      expect(w.exercises.length).toBeGreaterThanOrEqual(MIN_EXERCISES_PER_DAY);
      const allowed = new Set(config.days[i].slotCategories.map(labelFor));
      for (const e of w.exercises) expect(allowed.has(e.category)).toBe(true);
    });
  });

  it("no exercise name repeats within the same generated day (freq 2-6)", () => {
    for (let freq = 2; freq <= 6; freq++) {
      const gen = generateProgram({ ...base, trainingFrequency: freq });
      for (const w of gen.phases[0].workouts) {
        const names = w.exercises.map((e) => e.name);
        expect(new Set(names).size).toBe(names.length);
      }
    }
  });
});
