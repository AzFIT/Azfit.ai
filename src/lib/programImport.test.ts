import { describe, expect, it } from "vitest";
import {
  parseProgramPaste,
  parseDay,
  parseOrder,
  parseTempo,
  parseRestSec,
  splitExerciseName,
  formatRest,
  formatTempo,
} from "./programImport";

const CANONICAL = `**Program Name:** 5-Day GBC: Strength & Stamina
**Weeks:** 4
**Training Method:** Free-form
**Description:** 4 sets per exercise (12/10/8/6) ascending load. 45s rest between paired sets.
| Day | Order | Exercise | Sets | Reps | Tempo | Rest |
| 1 | A1 | Front Squat (Barbell) | 4 | 12/10/8/6 | 4010 | 45s |
| 1 | A2 | Neutral-Grip Pull-Up (Use lifting straps) | 4 | 12/10/8/6 | 3010 | 45s |`;

describe("metadata", () => {
  it("parses the canonical markdown-bold metadata block", () => {
    const r = parseProgramPaste(CANONICAL);
    expect(r.meta.name).toBe("5-Day GBC: Strength & Stamina");
    expect(r.meta.weeks).toBe(4);
    expect(r.meta.method).toBe("Free-form");
    expect(r.meta.description).toBe(
      "4 sets per exercise (12/10/8/6) ascending load. 45s rest between paired sets."
    );
  });

  it("parses plain (non-bold) metadata keys and 'Method:' alias", () => {
    const r = parseProgramPaste(
      "Program Name: Test\nWeeks: 6\nMethod: GBC\nDescription: x\n| Day | Exercise | Sets |\n| 1 | Squat | 3 |"
    );
    expect(r.meta).toEqual({ name: "Test", weeks: 6, method: "GBC", description: "x" });
  });

  it("reports unparseable weeks as an error, not silently", () => {
    const r = parseProgramPaste("Weeks: soon\n| Day | Exercise | Sets |\n| 1 | Squat | 3 |");
    expect(r.meta.weeks).toBeUndefined();
    expect(r.errors.some((e) => e.line === 1 && /weeks/i.test(e.reason))).toBe(true);
  });

  it("tolerates metadata appearing after the table", () => {
    const r = parseProgramPaste("| Day | Exercise | Sets |\n| 1 | Squat | 3 |\nWeeks: 2");
    // After the table starts, non-rows are reported — documented behavior.
    expect(r.rows).toHaveLength(1);
    expect(r.errors.length).toBe(1);
  });
});

describe("canonical table rows", () => {
  it("parses both canonical rows with zero errors", () => {
    const r = parseProgramPaste(CANONICAL);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    const [a1, a2] = r.rows;
    expect(a1).toMatchObject({ line: 6, day: 1, order: "A1", exercise: "Front Squat", sets: 4, reps: "12/10/8/6", tempo: "4010", restSec: 45 });
    expect(a1.notes).toBe("Barbell");
    expect(a2).toMatchObject({ order: "A2", exercise: "Neutral-Grip Pull-Up", tempo: "3010", restSec: 45 });
    expect(a2.notes).toBe("Use lifting straps");
  });

  it("accepts 'Day N' day cells", () => {
    const r = parseProgramPaste("| Day | Exercise | Sets |\n| Day 2 | Squat | 3 |");
    expect(r.rows[0]?.day).toBe(2);
    expect(r.errors).toEqual([]);
  });

  it("keeps slash and range reps verbatim", () => {
    const r = parseProgramPaste(
      "| Day | Exercise | Sets | Reps |\n| 1 | A | 4 | 12/10/8/6 |\n| 1 | B | 2 | 6-12 |"
    );
    expect(r.rows.map((x) => x.reps)).toEqual(["12/10/8/6", "6-12"]);
  });

  it("normalizes dashed tempo to 4 digits and keeps 4-digit tempo", () => {
    const r = parseProgramPaste(
      "| Day | Exercise | Sets | Tempo |\n| 1 | A | 3 | 3-0-1-0 |\n| 1 | B | 3 | 4010 |"
    );
    expect(r.rows.map((x) => x.tempo)).toEqual(["3010", "4010"]);
  });

  it("parses rest variants (45s / 90 / 1:16 / 2:00) to seconds", () => {
    expect(parseRestSec("45s")).toBe(45);
    expect(parseRestSec("90")).toBe(90);
    expect(parseRestSec("1:16")).toBe(76);
    expect(parseRestSec("2:00")).toBe(120);
    const r = parseProgramPaste(
      "| Day | Exercise | Sets | Rest |\n| 1 | A | 3 | 90 |\n| 1 | B | 3 | 1:16 |"
    );
    expect(r.rows.map((x) => x.restSec)).toEqual([90, 76]);
  });

  it("flags unparseable rest as a line error", () => {
    const r = parseProgramPaste("| Day | Exercise | Sets | Rest |\n| 1 | A | 3 | soon |");
    expect(r.rows).toEqual([]);
    expect(r.errors[0]).toMatchObject({ line: 2 });
    expect(/rest/i.test(r.errors[0].reason)).toBe(true);
  });
});

describe("exercise cell splitting", () => {
  it("splits 'X or Y' alternates: primary kept, alternate flagged", () => {
    const r = splitExerciseName("Hack Squat or Leg Press");
    expect(r).toEqual({ primary: "Hack Squat", alternate: "Leg Press" });
  });

  it("alternate + parenthetical combine correctly", () => {
    const r = splitExerciseName("Hack Squat or Leg Press (Use lifting straps)");
    expect(r?.primary).toBe("Hack Squat");
    expect(r?.alternate).toBe("Leg Press");
    expect(r?.notes).toBe("Use lifting straps");
  });

  it("multiple parentheticals join with '; '", () => {
    const r = splitExerciseName("Back Squat (Barbell) (Pause at the bottom)");
    expect(r?.primary).toBe("Back Squat");
    expect(r?.notes).toBe("Barbell; Pause at the bottom");
    expect(r?.alternate).toBeUndefined();
  });

  it("returns null for empty cells", () => {
    expect(splitExerciseName("")).toBeNull();
    expect(splitExerciseName("(only a note)")).toBeNull();
  });
});

describe("format auto-detection", () => {
  const TSV =
    "Day\tOrder\tExercise\tSets\tReps\tTempo\tRest\n1\tA1\tFront Squat\t4\t12/10/8/6\t4010\t45s";
  const CSV = "Day,Order,Exercise,Sets,Reps,Tempo,Rest\n1,A1,Front Squat,4,12/10/8/6,4010,45s";

  it("TSV paste parses identically to the markdown canonical", () => {
    const r = parseProgramPaste(TSV);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ day: 1, order: "A1", exercise: "Front Squat", sets: 4, reps: "12/10/8/6", tempo: "4010", restSec: 45 });
  });

  it("CSV paste (Google Sheets) parses identically", () => {
    const r = parseProgramPaste(CSV);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ order: "A1", exercise: "Front Squat", restSec: 45 });
  });

  it("markdown without outer pipes still parses", () => {
    const r = parseProgramPaste("Day | Order | Exercise | Sets\n1 | A1 | Squat | 3");
    expect(r.errors).toEqual([]);
    expect(r.rows[0]?.exercise).toBe("Squat");
  });
});

describe("honest errors — nothing silently dropped", () => {
  it("every garbage line is reported with its 1-based line number", () => {
    const r = parseProgramPaste(
      "hello world\n\n| Day | Exercise | Sets |\n| 1 | Squat | 3 |\ntrailing junk\n| x | y | z |"
    );
    expect(r.rows).toHaveLength(1);
    expect(r.errors.map((e) => e.line)).toEqual([1, 5, 6]);
    expect(r.errors[0].content).toBe("hello world");
  });

  it("bad day, bad sets, bad exercise each get their own line error", () => {
    const r = parseProgramPaste(
      "| Day | Exercise | Sets |\n| zero | Squat | 3 |\n| 1 |  | 3 |\n| 1 | Squat | lots |"
    );
    expect(r.rows).toEqual([]);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  it("day out of range (0 / 9) is an error", () => {
    expect(parseDay("0")).toBeNull();
    expect(parseDay("9")).toBeNull();
    expect(parseDay("Day 3")).toBe(3);
  });

  it("separator rows and blank lines are skipped, not errors", () => {
    const r = parseProgramPaste(
      "| Day | Exercise | Sets |\n| --- | --- | --- |\n\n| 1 | Squat | 3 |\n\n"
    );
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });

  it("preserves the offending content in each error", () => {
    const r = parseProgramPaste("totally bogus");
    expect(r.errors[0]).toEqual({ line: 1, reason: expect.stringContaining("metadata"), content: "totally bogus" });
  });
});

describe("field parsers", () => {
  it("parseOrder uppercases and validates", () => {
    expect(parseOrder("a1")).toBe("A1");
    expect(parseOrder("B2")).toBe("B2");
    expect(parseOrder("12")).toBeNull();
    expect(parseOrder("A")).toBeNull();
  });

  it("parseTempo accepts 4 digits and dashed quads only", () => {
    expect(parseTempo("4010")).toBe("4010");
    expect(parseTempo("3-0-1-0")).toBe("3010");
    expect(parseTempo("40")).toBeNull();
    expect(parseTempo("fast")).toBeNull();
  });

  it("parseRestSec rejects garbage", () => {
    expect(parseRestSec("1:99")).toBeNull();
    expect(parseRestSec("abc")).toBeNull();
    expect(parseRestSec("")).toBeNull();
  });
});

describe("builder formatting helpers", () => {
  it("formatRest: <60 → 'Ns', ≥60 → m:ss", () => {
    expect(formatRest(45)).toBe("45s");
    expect(formatRest(90)).toBe("1:30");
    expect(formatRest(120)).toBe("2:00");
  });

  it("formatTempo: 4 digits → dashed quads", () => {
    expect(formatTempo("4010")).toBe("4-0-1-0");
    expect(formatTempo("3010")).toBe("3-0-1-0");
  });
});

describe("multi-day program", () => {
  it("groups rows across 5 days in order", () => {
    const lines = ["| Day | Order | Exercise | Sets |", "| 1 | A1 | Squat | 4 |", "| 2 | A1 | Bench | 4 |", "| 5 | C1 | Curl | 3 |"];
    const r = parseProgramPaste(lines.join("\n"));
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.day)).toEqual([1, 2, 5]);
  });
});
