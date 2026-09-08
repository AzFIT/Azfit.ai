import { describe, it, expect } from "vitest";
import {
  parsePairKey,
  sessionSupportsPairs,
  pairsOf,
  insertPair,
  removePair,
  updateRow,
  validateRowPatch,
  regenerateSession,
  validateSession,
} from "./trainingEditor";
import type { GbcSession } from "./planBlueprint";
import type { TaxonomyExercise } from "./exerciseTaxonomy";

const SESSION: GbcSession = {
  name: "Session A — Lower Emphasis (trainer)",
  kind: "trainer",
  blocks: [
    { label: "A1", exercises: "Goblet Squat", setsReps: "3 × 10–12", tempo: "40X0", rest: "30s" },
    { label: "A2", exercises: "Lat Pulldown", setsReps: "3 × 10–12", tempo: "3010", rest: "60s" },
    { label: "B1", exercises: "DB Romanian Deadlift", setsReps: "3 × 10–12", tempo: "3010", rest: "30s" },
    { label: "B2", exercises: "Incline DB Press", setsReps: "3 × 10–12", tempo: "3010", rest: "60s" },
    { label: "C1", exercises: "Reverse Lunge", setsReps: "2 × 10/side", tempo: "2010", rest: "30s" },
    { label: "C2", exercises: "Seated Row", setsReps: "2 × 10–12", tempo: "2010", rest: "60s" },
  ],
  finisher: "Farmer's Carry — 2 × 40 m",
};

const SOLO: GbcSession = {
  name: "Session C — Solo Circuit",
  kind: "solo",
  blocks: [
    { label: "1", exercises: "Goblet Squat", setsReps: "× 12", tempo: "controlled", rest: "—" },
    { label: "2", exercises: "Incline Push-up", setsReps: "× 8–12", tempo: "controlled", rest: "—" },
  ],
};

const LIB: TaxonomyExercise[] = [
  { id: "1", name: "Goblet Squat", primary_muscle: "Quads", secondary_muscle: null, equipment: "Dumbbells", exercise_type: "Compound" },
  { id: "2", name: "Lat Pulldown", primary_muscle: "Back", secondary_muscle: null, equipment: "Cable", exercise_type: "Compound" },
  { id: "3", name: "DB Romanian Deadlift", primary_muscle: "Hamstrings", secondary_muscle: null, equipment: "Dumbbells", exercise_type: "Compound" },
  { id: "4", name: "Incline DB Press", primary_muscle: "Chest", secondary_muscle: null, equipment: "Dumbbells", exercise_type: "Compound" },
  { id: "5", name: "Reverse Lunge", primary_muscle: "Quads", secondary_muscle: null, equipment: "Bodyweight", exercise_type: "Compound" },
  { id: "6", name: "Seated Row", primary_muscle: "Back", secondary_muscle: null, equipment: "Cable", exercise_type: "Compound" },
  { id: "7", name: "Leg Press", primary_muscle: "Quads", secondary_muscle: null, equipment: "Machine", exercise_type: "Compound" },
  { id: "8", name: "Bulgarian Split Squat", primary_muscle: "Quads", secondary_muscle: null, equipment: "Dumbbells", exercise_type: "Compound" },
  { id: "9", name: "Chest Supported Row", primary_muscle: "Back", secondary_muscle: null, equipment: "Machine", exercise_type: "Compound" },
  { id: "10", name: "Pull-Up", primary_muscle: "Back", secondary_muscle: null, equipment: "Bodyweight", exercise_type: "Compound" },
  { id: "11", name: "Nordic Curl", primary_muscle: "Hamstrings", secondary_muscle: null, equipment: "Bodyweight", exercise_type: "Compound" },
  { id: "12", name: "Floor Press", primary_muscle: "Chest", secondary_muscle: null, equipment: "Barbell", exercise_type: "Compound" },
];

describe("label parsing + pair support", () => {
  it("parses pair labels", () => {
    expect(parsePairKey("A1")).toEqual({ letter: "A", num: 1 });
    expect(parsePairKey("C2")).toEqual({ letter: "C", num: 2 });
    expect(parsePairKey("1")).toBeNull();
  });

  it("detects pair vs solo sessions", () => {
    expect(sessionSupportsPairs(SESSION)).toBe(true);
    expect(sessionSupportsPairs(SOLO)).toBe(false);
    expect(pairsOf(SOLO)).toBeNull();
  });

  it("groups blocks into pairs", () => {
    const pairs = pairsOf(SESSION)!;
    expect(pairs.map((p) => p.letter)).toEqual(["A", "B", "C"]);
    expect(pairs[0].blocks[1].label).toBe("A2");
  });
});

describe("insertPair / removePair", () => {
  it("inserts after the named pair and relabels", () => {
    const next = insertPair(SESSION, "A2")!;
    expect(next.blocks.map((b) => b.label)).toEqual(["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"]);
    expect(next.blocks[2].exercises).toBe(""); // fresh empty placeholder
    expect(next.blocks[3].exercises).toBe("");
    // old B pair shifted to C
    expect(next.blocks[4].exercises).toBe("DB Romanian Deadlift");
  });

  it("rejects insert into a solo (numeric) session", () => {
    expect(insertPair(SOLO, "1")).toBeNull();
  });

  it("removes a pair and relabels subsequent pairs", () => {
    const next = removePair(SESSION, "B")!;
    expect(next.blocks.map((b) => b.label)).toEqual(["A1", "A2", "B1", "B2"]);
    expect(next.blocks[2].exercises).toBe("Reverse Lunge"); // old C1 → B1
    expect(next.blocks[3].exercises).toBe("Seated Row");
  });

  it("never removes the last pair", () => {
    const onePair: GbcSession = { ...SESSION, blocks: SESSION.blocks.slice(0, 2) };
    expect(removePair(onePair, "A")).toBeNull();
  });

  it("finisher/rounds survive pair ops", () => {
    expect(insertPair(SESSION, "C2")!.finisher).toBe(SESSION.finisher);
    expect(removePair(SESSION, "A")!.finisher).toBe(SESSION.finisher);
  });
});

describe("updateRow + validation", () => {
  it("applies a valid patch", () => {
    const next = updateRow(SESSION, "A1", { tempo: "4010" })!;
    expect(next.blocks[0].tempo).toBe("4010");
    expect(next.blocks[0].exercises).toBe("Goblet Squat"); // untouched
  });

  it("accepts the 61 template's own tempo values (40X0)", () => {
    expect(validateRowPatch({ tempo: "40X0" }).valid).toBe(true);
    expect(validateRowPatch({ tempo: "controlled" }).valid).toBe(true);
    expect(validateRowPatch({ tempo: "slow" }).valid).toBe(true);
  });

  it("rejects invalid tempo/rest/empty fields", () => {
    expect(validateRowPatch({ tempo: "fast!" }).valid).toBe(false);
    expect(validateRowPatch({ rest: "a minute" }).valid).toBe(false);
    expect(validateRowPatch({ rest: "—" }).valid).toBe(true);
    expect(validateRowPatch({ exercises: "  " }).valid).toBe(false);
    expect(validateRowPatch({ setsReps: "" }).valid).toBe(false);
    expect(updateRow(SESSION, "A1", { tempo: "xx" })).toBeNull();
  });
});

describe("regenerateSession", () => {
  it("preserves structure exactly and re-rolls within the same pattern", () => {
    const r = regenerateSession(SESSION, LIB, { seed: 7 });
    const a = SESSION.blocks.map((b) => [b.label, b.setsReps, b.tempo, b.rest]);
    const b = r.session.blocks.map((x) => [x.label, x.setsReps, x.tempo, x.rest]);
    expect(b).toEqual(a);
    expect(r.session.name).toBe(SESSION.name);
    expect(r.session.finisher).toBe(SESSION.finisher);
    // every re-rolled exercise shares the original's pattern
    for (let i = 0; i < SESSION.blocks.length; i++) {
      const orig = LIB.find((e) => e.name === SESSION.blocks[i].exercises)!;
      const next = LIB.find((e) => e.name === r.session.blocks[i].exercises)!;
      expect(next.primary_muscle).toBe(orig.primary_muscle);
    }
  });

  it("produces zero duplicate exercise names", () => {
    const r = regenerateSession(SESSION, LIB, { seed: 3 });
    const names = r.session.blocks.map((b) => b.exercises);
    expect(new Set(names).size).toBe(names.length);
  });

  it("is deterministic for the same seed", () => {
    const a = regenerateSession(SESSION, LIB, { seed: 11 });
    const b = regenerateSession(SESSION, LIB, { seed: 11 });
    expect(a.session).toEqual(b.session);
  });

  it("keeps unknown exercises with an honest note", () => {
    const weird: GbcSession = {
      ...SESSION,
      blocks: [{ label: "A1", exercises: "Coach's Special Squat", setsReps: "3 × 8", tempo: "3010", rest: "30s" }],
    };
    const r = regenerateSession(weird, LIB, { seed: 1 });
    expect(r.session.blocks[0].exercises).toBe("Coach's Special Squat");
    expect(r.notes.some((n) => n.includes("isn't in the exercise library"))).toBe(true);
  });
});

describe("validateSession", () => {
  it("flags empty exercises (from a fresh inserted pair) and duplicates", () => {
    const withEmpty = insertPair(SESSION, "A2")!;
    expect(validateSession(withEmpty).valid).toBe(false);
    const dupe: GbcSession = {
      ...SESSION,
      blocks: SESSION.blocks.map((b) => ({ ...b, exercises: "Goblet Squat" })),
    };
    expect(validateSession(dupe).valid).toBe(false);
    expect(validateSession(SESSION).valid).toBe(true);
  });
});
