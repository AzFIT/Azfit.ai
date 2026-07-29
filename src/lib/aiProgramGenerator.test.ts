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
