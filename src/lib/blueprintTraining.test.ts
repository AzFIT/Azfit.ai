/* Phase 99c Item 1 — blueprintTraining unit tests. */
import { describe, expect, it } from "vitest";
import { buildVariedSessions, familiesOf, type TaxonomyExerciseLike } from "./blueprintTraining";

function ex(
  name: string,
  primary: string,
  type: string,
  equipment: string,
  difficulty = "Intermediate",
  id?: string,
): TaxonomyExerciseLike {
  return { id: id ?? name, name, primary_muscle: primary, secondary_muscle: null, equipment, exercise_type: type, difficulty };
}

/* Library big enough for full variety across 2 trainer + 1 solo session. */
function bigLibrary(): TaxonomyExerciseLike[] {
  const rows: TaxonomyExerciseLike[] = [];
  const compounds: [string, string][] = [
    ["legs", "Quadriceps"], ["hinge", "Posterior Chain"], ["push", "Chest"], ["pull", "Back"],
    ["glutes", "Glutes"], ["push", "Shoulders"], ["pull", "Biceps"], ["legs", "Quads/Glutes"],
  ];
  compounds.forEach(([fam, muscle]) => {
    for (let n = 0; n < 6; n++) rows.push(ex(`${muscle} Compound ${fam} ${n}`, muscle, "Compound", "Dumbbell", "Intermediate", `c-${fam}-${n}`));
  });
  for (let n = 0; n < 8; n++) {
    rows.push(ex(`Lateral Raise ${n}`, "Shoulders", "Isolation", "Dumbbell", "Intermediate", `iso-push-${n}`));
    rows.push(ex(`Curl ${n}`, "Biceps", "Isolation", "Dumbbell", "Intermediate", `iso-pull-${n}`));
    rows.push(ex(`Leg Extension ${n}`, "Quadriceps", "Isolation", "Machine", "Intermediate", `iso-legs-${n}`));
    rows.push(ex(`Plank ${n}`, "Abs", "Core", "Bodyweight", "Intermediate", `iso-core-${n}`));
  }
  // Beginner solo-safe pool
  for (let n = 0; n < 4; n++) {
    rows.push(ex(`Beginner Squat ${n}`, "Quadriceps", "Compound", "Bodyweight", "Beginner", `b-leg-${n}`));
    rows.push(ex(`Beginner Push-up ${n}`, "Chest", "Compound", "Bodyweight", "Beginner", `b-push-${n}`));
    rows.push(ex(`Beginner Row ${n}`, "Back", "Compound", "Dumbbell", "Beginner", `b-pull-${n}`));
    rows.push(ex(`Beginner Bridge ${n}`, "Glutes", "Compound", "Bodyweight", "Beginner", `b-hinge-${n}`));
    rows.push(ex(`Beginner Dead Bug ${n}`, "Abs", "Core", "Bodyweight", "Beginner", `b-core-${n}`));
  }
  return rows;
}

const baseInput = {
  trainerSessionsPerWeek: 2,
  soloSessionsPerWeek: 1,
  equipmentAccess: "dumbbells_only" as const,
  injuriesNotes: "",
  isFatLoss: true,
};

describe("familiesOf", () => {
  it("splits compound primary_muscle labels", () => {
    expect(familiesOf("Quads/Glutes").sort()).toEqual(["glutes", "legs"]);
    expect(familiesOf("Back/Biceps")).toEqual(["pull"]);
    expect(familiesOf("Chest/Triceps")).toEqual(["push"]);
  });
  it("returns empty for null/unknown", () => {
    expect(familiesOf(null)).toEqual([]);
    expect(familiesOf("Mystery Muscle")).toEqual([]);
  });
});

describe("buildVariedSessions", () => {
  it("returns null on an empty taxonomy (caller falls back)", () => {
    expect(buildVariedSessions(baseInput, [])).toBeNull();
  });

  it("produces the requested session mix", () => {
    const r = buildVariedSessions(baseInput, bigLibrary());
    expect(r).not.toBeNull();
    expect(r!.sessions.filter((s) => s.kind === "trainer")).toHaveLength(2);
    expect(r!.sessions.filter((s) => s.kind === "solo")).toHaveLength(1);
    expect(r!.varied).toBe(true);
  });

  it("never repeats an exercise across sessions when the library allows it", () => {
    const r = buildVariedSessions(baseInput, bigLibrary())!;
    const names = r.sessions.flatMap((s) => s.blocks.map((b) => b.exercises));
    expect(new Set(names).size).toBe(names.length);
  });

  it("is deterministic for the same seed and differs across seeds", () => {
    const a = buildVariedSessions(baseInput, bigLibrary(), { seed: 7 })!;
    const b = buildVariedSessions(baseInput, bigLibrary(), { seed: 7 })!;
    const c = buildVariedSessions(baseInput, bigLibrary(), { seed: 8 })!;
    expect(a.sessions).toEqual(b.sessions);
    expect(a.sessions).not.toEqual(c.sessions);
  });

  it("gates equipment by access tier (dumbbells_only excludes machines)", () => {
    const lib = [
      ex("Machine Press", "Chest", "Compound", "Machine"),
      ex("DB Press", "Chest", "Compound", "Dumbbell"),
      ...bigLibrary(),
    ];
    const r = buildVariedSessions({ ...baseInput, soloSessionsPerWeek: 0, trainerSessionsPerWeek: 1 }, lib)!;
    const names = r.sessions.flatMap((s) => s.blocks.map((b) => b.exercises));
    expect(names).not.toContain("Machine Press");
  });

  it("exercises flagged by injury keywords are excluded", () => {
    const lib = [ex("Knee-Friendly Press", "Chest", "Compound", "Dumbbell"), ...bigLibrary()];
    const r = buildVariedSessions({ ...baseInput, soloSessionsPerWeek: 0, injuriesNotes: "sore left knee" }, lib)!;
    const names = r.sessions.flatMap((s) => s.blocks.map((b) => b.exercises));
    // knee flags legs/hinge/glutes families — leg compounds must not appear
    expect(names.some((n) => /Squat|Lunge|Deadlift|Extension|Bridge/i.test(n))).toBe(false);
    expect(r.notes.join(" ")).toMatch(/knee/i);
  });

  it("solo sessions use Beginner-only, non-barbell exercises when available", () => {
    const lib = [
      ex("Advanced Barbell Clean", "Full Body", "Olympic", "Barbell", "Advanced"),
      ...bigLibrary(),
    ];
    const r = buildVariedSessions(baseInput, lib)!;
    const solo = r.sessions.find((s) => s.kind === "solo")!;
    const names = solo.blocks.map((b) => b.exercises);
    expect(names).not.toContain("Advanced Barbell Clean");
    expect(names.every((n) => /^Beginner/.test(n))).toBe(true);
  });

  it("falls back to honest notes when the Beginner pool is too small", () => {
    const tiny: TaxonomyExerciseLike[] = [
      ex("Only Beginner Squat", "Quadriceps", "Compound", "Bodyweight", "Beginner"),
      ex("Int Press A", "Chest", "Compound", "Dumbbell"),
      ex("Int Press B", "Chest", "Compound", "Dumbbell"),
    ];
    const r = buildVariedSessions({ ...baseInput, trainerSessionsPerWeek: 0 }, tiny)!;
    expect(r.notes.join(" ")).toMatch(/Beginner-only/);
  });

  it("fat-loss plans bias the finisher to the incline walk", () => {
    const r = buildVariedSessions({ ...baseInput, equipmentAccess: "full_gym" }, bigLibrary())!;
    for (const s of r.sessions.filter((x) => x.kind === "trainer")) {
      expect(s.finisher).toMatch(/Incline walk/);
    }
  });
});
