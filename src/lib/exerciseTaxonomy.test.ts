import { describe, it, expect } from "vitest";
import {
  normalizeExerciseName,
  patternForMuscle,
  patternForExercise,
  dayPatternsForLabel,
  isPatternCompatible,
  buildTaxonomyIndex,
  findTaxonomyMatch,
  similarExercises,
  type TaxonomyExercise,
} from "./exerciseTaxonomy";

const row = (
  name: string,
  primary: string | null,
  secondary: string | null = null,
  equipment: string | null = "Barbell",
  type: string | null = "Compound",
): TaxonomyExercise => ({
  id: name,
  name,
  primary_muscle: primary,
  secondary_muscle: secondary,
  equipment,
  exercise_type: type,
});

describe("normalizeExerciseName (52A canonical aliases)", () => {
  it("bridges long-form equipment aliases to the library's short forms", () => {
    expect(normalizeExerciseName("Barbell Row")).toBe(normalizeExerciseName("BB Row"));
    expect(normalizeExerciseName("Dumbbell Bench Press")).toBe(normalizeExerciseName("DB Bench Press"));
    // equipment-PREFIXED library names ('BB Back Squat' vs 'Back Squat') are
    // bridged one level up by findTaxonomyMatch's stripped-token fallback
    expect(normalizeExerciseName("Back Squat")).not.toBe(normalizeExerciseName("BB Back Squat"));
  });

  it("collapses punctuation and whitespace", () => {
    expect(normalizeExerciseName("Lat Pulldown - Pronated Mid Grip")).toBe("lat pulldown pronated mid grip");
    expect(normalizeExerciseName("15° DB Incline Press")).toBe(normalizeExerciseName("15 Dumbbell Incline Press"));
  });
});

describe("pattern classification from the 52B muscle vocabulary", () => {
  it("maps the live muscle names case-insensitively; unknown → any", () => {
    expect(patternForMuscle("Back")).toBe("pull");
    expect(patternForMuscle("quads")).toBe("legs");
    expect(patternForMuscle(" Upper Chest ")).toBe("push");
    expect(patternForMuscle("Abs")).toBe("core");
    expect(patternForMuscle("Cardio")).toBe("any");
    expect(patternForMuscle("Something Made Up")).toBe("any");
    expect(patternForMuscle(null)).toBe("any");
  });

  it("primary muscle wins; secondary only breaks an 'any' primary", () => {
    expect(patternForExercise("Back", "Biceps")).toBe("pull"); // Barbell Row
    expect(patternForExercise("NA", "Glutes")).toBe("legs");
    expect(patternForExercise("NA", null)).toBe("any");
    expect(patternForExercise("Chest", "Back")).toBe("push");
  });

  it("Barbell Row is a pull: incompatible with a Push day, fine on Pull/Full days", () => {
    const barbellRow = patternForExercise("Back", "Biceps");
    expect(isPatternCompatible("Push — Chest/Shoulders/Tris", barbellRow)).toBe(false);
    expect(isPatternCompatible("Pull — Back/Biceps", barbellRow)).toBe(true);
    expect(isPatternCompatible("Full Body A", barbellRow)).toBe(true);
  });

  it("core and unclassifiable work fit every day", () => {
    expect(isPatternCompatible("Push — Chest/Shoulders/Tris", "core")).toBe(true);
    expect(isPatternCompatible("Legs — Quads/Hams/Calves", "any")).toBe(true);
    expect(isPatternCompatible("Legs — Quads/Hams/Calves", "push")).toBe(false);
  });

  it("derives day patterns from the wizard's label vocabulary", () => {
    expect([...dayPatternsForLabel("Upper — Push Focus")].sort()).toEqual(["pull", "push"]);
    expect([...dayPatternsForLabel("Lower — Squat Focus")]).toEqual(["legs"]);
    expect([...dayPatternsForLabel("Full Body B")].sort()).toEqual(["legs", "pull", "push"]);
    expect([...dayPatternsForLabel("Arms Day")].sort()).toEqual(["pull", "push"]);
    expect([...dayPatternsForLabel("Back Day")]).toEqual(["pull"]);
    // unknown labels give no basis → everything allowed (never flag blindly)
    expect(dayPatternsForLabel("Workout A").size).toBe(3);
  });
});

describe("taxonomy index + matching", () => {
  it("keeps the first row for pre-existing duplicate library names", () => {
    const rows = [row("Machine Chest Supported Row", "Back"), row("Machine Chest Supported Row", "Back")];
    const index = buildTaxonomyIndex(rows);
    expect(index.exact.size).toBe(1);
    expect(findTaxonomyMatch("Machine Chest Supported Row", index)?.id).toBe("Machine Chest Supported Row");
  });

  it("matches legacy rotation names against library rows", () => {
    const index = buildTaxonomyIndex([row("BB Back Squat", "Quads"), row("Barbell Row", "Back")]);
    expect(findTaxonomyMatch("Back Squat", index)?.name).toBe("BB Back Squat");
    expect(findTaxonomyMatch("Barbell Row", index)?.primary_muscle).toBe("Back");
    expect(findTaxonomyMatch("Not A Real Exercise", index)).toBeNull();
  });
});

describe("similarExercises (Change exercise → Similar)", () => {
  const library: TaxonomyExercise[] = [
    row("Barbell Row", "Back", "Biceps"),
    row("T Bar Row", "Back", "Biceps", "Other"),
    row("Seated Cable Row", "Back", "Biceps", "Cable"),
    row("Lat Pulldown", "Back", "Biceps", "Cable"),
    row("Flat BB Bench Press", "Chest", "Triceps"),
    row("Back Squat", "Quads", "Glutes"),
    row("Machine Chest Supported Row", "Back", null, "Machine", "Compound"),
    row("Face Pull", "Rear Delts", "Upper Back", "Cable", "Isolation"),
  ];

  it("ranks same-primary rows first, excludes self + week names", () => {
    const out = similarExercises("Barbell Row", library, { excludedNames: ["Lat Pulldown"] });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.matched)).toBe(true);
    expect(out.map((c) => c.row.name)).not.toContain("Barbell Row");
    expect(out.map((c) => c.row.name)).not.toContain("Lat Pulldown");
    // all survivors are pull-pattern rows (the bench/squat never qualify)
    expect(out.map((c) => c.row.name)).not.toContain("Flat BB Bench Press");
    expect(out.map((c) => c.row.name)).not.toContain("Back Squat");
    // same-primary rows outrank a pattern-only row
    const facePullIdx = out.findIndex((c) => c.row.name === "Face Pull");
    const tBarIdx = out.findIndex((c) => c.row.name === "T Bar Row");
    expect(tBarIdx).toBeGreaterThanOrEqual(0);
    if (facePullIdx >= 0) expect(tBarIdx).toBeLessThan(facePullIdx);
    expect(out[0].reason).toContain("Same primary muscle (Back)");
  });

  it("falls back to an honest day-pattern list when the name is not in the library", () => {
    const out = similarExercises("Made Up Press", library, { fallbackDayLabel: "Push — Chest/Shoulders/Tris" });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => !c.matched)).toBe(true);
    expect(out.map((c) => c.row.name)).toContain("Flat BB Bench Press");
    expect(out.map((c) => c.row.name)).not.toContain("Barbell Row");
  });
});
