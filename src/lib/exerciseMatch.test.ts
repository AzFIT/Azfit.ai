/* ═══════════════════════════════════════════════════════════════
   Phase 93 — exercise matcher unit tests (pure, offline).

   Uses a representative slice of the real exercise_library naming
   conventions (parentheticals, hyphenation, "Barbell" qualifiers).
   Band contract (named constants from exerciseMatch.ts):
     ≥ AUTO_MATCH_THRESHOLD → best set
     ≥ SUGGEST_THRESHOLD    → best null, suggestions offered
     <  SUGGEST_THRESHOLD   → unmatched
   ═══════════════════════════════════════════════════════════════ */

import { describe, expect, it } from "vitest";
import {
  AUTO_MATCH_THRESHOLD,
  SUGGEST_THRESHOLD,
  levenshtein,
  matchExercise,
  normalizeExerciseName,
} from "./exerciseMatch";

interface Ex {
  id: string;
  name: string;
}

/** Representative real-library naming slice. */
const LIB: Ex[] = [
  { id: "1", name: "Front Squat (Barbell)" },
  { id: "2", name: "Hack Squat" },
  { id: "3", name: "Neutral Grip Pull Up" },
  { id: "4", name: "Barbell Back Squat" },
  { id: "5", name: "Leg Press" },
  { id: "6", name: "Romanian Deadlift" },
  { id: "7", name: "Dumbbell Bench Press" },
  { id: "8", name: "Walking Lunge" },
];

describe("normalizeExerciseName", () => {
  it("lowercases, strips parentheticals and punctuation", () => {
    expect(normalizeExerciseName("Front Squat (Barbell)")).toBe("front squat");
    expect(normalizeExerciseName("Neutral-Grip Pull-Up")).toBe("neutral grip pull up");
    expect(normalizeExerciseName("  Use  Lifting   Straps ")).toBe("use lifting straps");
  });

  it("empty / parenthetical-only input normalizes to empty", () => {
    expect(normalizeExerciseName("")).toBe("");
    expect(normalizeExerciseName("(only a note)")).toBe("");
  });
});

describe("levenshtein", () => {
  it("basics", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("matchExercise — auto-match band (≥ AUTO_MATCH_THRESHOLD)", () => {
  it('"Neutral-Grip Pull-Up" auto-matches "Neutral Grip Pull Up" (hyphenation)', () => {
    const r = matchExercise("Neutral-Grip Pull-Up", LIB);
    expect(r.best?.name).toBe("Neutral Grip Pull Up");
    expect(r.score).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });

  it('"Front Squat" auto-matches "Front Squat (Barbell)" (parenthetical strip)', () => {
    const r = matchExercise("Front Squat", LIB);
    expect(r.best?.name).toBe("Front Squat (Barbell)");
    expect(r.score).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });

  it("exact library name auto-matches with a perfect score", () => {
    const r = matchExercise("Hack Squat", LIB);
    expect(r.best?.name).toBe("Hack Squat");
    expect(r.score).toBe(1);
  });

  it("auto-match excludes best from suggestions", () => {
    const r = matchExercise("Hack Squat", LIB);
    expect(r.suggestions.map((s) => s.id)).not.toContain(r.best?.id);
  });
});

describe("matchExercise — suggest band (SUGGEST_THRESHOLD ≤ score < AUTO_MATCH_THRESHOLD)", () => {
  it('"Hac Sqaut" lands in the suggest band against "Hack Squat" — no auto-match, suggestion offered', () => {
    const r = matchExercise("Hac Sqaut", LIB);
    expect(r.best).toBeNull();
    expect(r.score).toBeGreaterThanOrEqual(SUGGEST_THRESHOLD);
    expect(r.score).toBeLessThan(AUTO_MATCH_THRESHOLD);
    expect(r.suggestions.map((s) => s.name)).toContain("Hack Squat");
  });

  it("suggest band still returns 3 suggestions", () => {
    const r = matchExercise("Hac Sqaut", LIB);
    expect(r.suggestions.length).toBe(3);
  });

  it("real-library shape: a qualified name ('Machine Hack Squat') still lands in the suggest band", () => {
    // Real 628-row library has NO plain "Hack Squat" — only the qualified name.
    const qualified: Ex[] = LIB.filter((e) => e.name !== "Hack Squat").concat([{ id: "100", name: "Machine Hack Squat" }]);
    const r = matchExercise("Hac Sqaut", qualified);
    expect(r.best).toBeNull();
    expect(r.score).toBeGreaterThanOrEqual(SUGGEST_THRESHOLD);
    expect(r.score).toBeLessThan(AUTO_MATCH_THRESHOLD);
    expect(r.suggestions[0]?.name).toBe("Machine Hack Squat");
  });
});

describe("matchExercise — unmatched band (< SUGGEST_THRESHOLD)", () => {
  it("a nonsense name is unmatched with a low score", () => {
    const r = matchExercise("Quantum Fluffernutter XYZ", LIB);
    expect(r.best).toBeNull();
    expect(r.score).toBeLessThan(SUGGEST_THRESHOLD);
  });

  it("unmatched still returns 3 suggestions for the review picker", () => {
    const r = matchExercise("Quantum Fluffernutter XYZ", LIB);
    expect(r.suggestions.length).toBe(3);
  });

  it("empty query returns an empty result", () => {
    const r = matchExercise("", LIB);
    expect(r.best).toBeNull();
    expect(r.score).toBe(0);
    expect(r.suggestions).toEqual([]);
  });

  it("empty library returns an empty result", () => {
    const r = matchExercise("Front Squat", []);
    expect(r.best).toBeNull();
    expect(r.score).toBe(0);
    expect(r.suggestions).toEqual([]);
  });
});

describe("matchExercise — thresholds are named constants with the spec'd values", () => {
  it("AUTO_MATCH_THRESHOLD = 0.8, SUGGEST_THRESHOLD = 0.5", () => {
    expect(AUTO_MATCH_THRESHOLD).toBe(0.8);
    expect(SUGGEST_THRESHOLD).toBe(0.5);
  });
});
