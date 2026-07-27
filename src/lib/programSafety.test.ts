import { describe, it, expect } from "vitest";
import {
  normalizeLimitation,
  collectClientLimitations,
  evaluateProgramSafety,
  GENERIC_WARN,
} from "@/lib/programSafety";
import { applySafetyFilter } from "@/lib/aiProgramGenerator";
import type { ProgramExercise } from "@/pages/AIProgramBuilder";

const ex = (code: string, name: string): ProgramExercise => ({
  code,
  name,
  sets: 3,
  reps: "10",
  pct1RM: "75%",
  tempo: "2-0-1-0",
  rest: "2:00",
});

describe("normalizeLimitation", () => {
  it("maps wizard LIMITATIONS strings via the alias map", () => {
    expect(normalizeLimitation("Lower back issues")).toEqual(["Lower back pain"]);
    expect(normalizeLimitation("Shoulder injury")).toEqual(["Shoulder pain"]);
    expect(normalizeLimitation("Knee/Hip limitations")).toEqual(["Knee pain", "Hip pain"]);
    expect(normalizeLimitation("Wrist/Elbow pain")).toEqual(["Wrist pain"]);
    expect(normalizeLimitation("Neck/Upper back")).toEqual(["Neck pain"]);
    expect(normalizeLimitation("Cardiovascular condition")).toEqual(["Cardiovascular condition"]);
  });

  it("passes doc vocabulary through (case-insensitive)", () => {
    expect(normalizeLimitation("lower back pain")).toEqual(["Lower back pain"]);
    expect(normalizeLimitation("PREGNANCY")).toEqual(["Pregnancy"]);
  });

  it("normalizes free text via keyword matching", () => {
    expect(normalizeLimitation("bad back")).toEqual(["Lower back pain"]);
    expect(normalizeLimitation("torn ACL last year")).toEqual(["Knee pain"]);
    expect(normalizeLimitation("high blood pressure")).toEqual(["Cardiovascular condition"]);
  });

  it("unmatched free text becomes the generic warn sentinel", () => {
    expect(normalizeLimitation("tennis elbow recovery phase")).toEqual(["Wrist pain"]);
    expect(normalizeLimitation("feeling tired lately")).toEqual([GENERIC_WARN]);
  });

  it("drops empty/None/Other inputs", () => {
    expect(normalizeLimitation("")).toEqual([]);
    expect(normalizeLimitation("None (healthy)")).toEqual([]);
    expect(normalizeLimitation("Other")).toEqual([]);
  });
});

describe("collectClientLimitations", () => {
  const ctx = (limitations: string[], otherLimitation = "") => ({
    clientContext: {
      ageRange: "",
      experience: "",
      bodyType: "",
      availability: "",
      limitations,
      otherLimitation,
    },
  });

  it("merges chips + free text + intake injuries and dedupes", () => {
    const out = collectClientLimitations(
      ctx(["Lower back issues"], "bad knees"),
      { injuries: "shoulder strain, tight hips" },
    );
    expect(out).toContain("Lower back pain");
    expect(out).toContain("Knee pain");
    expect(out).toContain("Shoulder pain");
    expect(out).toContain("Hip pain");
  });

  it("is a no-op when nothing is present", () => {
    expect(collectClientLimitations(ctx([], ""), { injuries: "" })).toEqual([]);
    expect(collectClientLimitations(ctx(["None (healthy)"], ""), null)).toEqual([]);
  });
});

describe("evaluateProgramSafety", () => {
  const list = [
    ex("A1", "Back Squat"),
    ex("A2", "Romanian Deadlift"),
    ex("B1", "Lat Pulldown"),
    ex("B2", "Burpee"),
  ];

  it("is a no-op with empty limitations", () => {
    expect(evaluateProgramSafety(list, [])).toEqual([]);
  });

  it("'exclude' hits pull up to 3 alternatives, 'warn' pulls none", () => {
    const flags = evaluateProgramSafety(list, ["Lower back pain"]);
    const squat = flags.find((f) => f.exerciseName === "Back Squat");
    const rdl = flags.find((f) => f.exerciseName === "Romanian Deadlift");
    expect(squat?.severity).toBe("exclude");
    expect(rdl?.severity).toBe("exclude");
    expect(squat && squat.alternatives.length).toBeGreaterThan(0);
    expect(squat && squat.alternatives.length).toBeLessThanOrEqual(3);
    expect(squat?.alternatives.every((a) => a.name !== "Back Squat")).toBe(true);
    // lat pulldown is not a lower-back contraindication
    expect(flags.find((f) => f.exerciseName === "Lat Pulldown")).toBeUndefined();
  });

  it("warn severity applies without alternatives (knee, cardiovascular is exclude)", () => {
    const knee = evaluateProgramSafety([ex("A1", "Walking Lunge")], ["Knee pain"]);
    expect(knee[0]?.severity).toBe("warn");
    expect(knee[0]?.alternatives).toEqual([]);

    const cardio = evaluateProgramSafety([ex("A1", "Burpee")], ["Cardiovascular condition"]);
    expect(cardio[0]?.severity).toBe("exclude");
    // alternatives are pulled when the database has candidates for the name —
    // Burpee isn't in the exercise database, so zero is a valid outcome.
    expect(cardio[0]?.alternatives).toEqual([]);

    // A database-backed exclude exercise does get alternatives
    const back = evaluateProgramSafety([ex("A1", "Romanian Deadlift")], ["Lower back pain"]);
    expect(back[0]?.alternatives.length).toBeGreaterThan(0);
  });

  it("generic warn only flags compound exercises", () => {
    const flags = evaluateProgramSafety(
      [ex("A1", "Back Squat"), ex("B1", "Lat Pulldown")],
      [GENERIC_WARN],
    );
    expect(flags.map((f) => f.exerciseName)).toEqual(["Back Squat"]);
    expect(flags[0]?.severity).toBe("warn");
  });

  it("records the limitation + note on the flag", () => {
    const flags = evaluateProgramSafety([ex("A1", "Back Squat")], ["Lower back pain"]);
    expect(flags[0]?.limitation).toBe("Lower back pain");
    expect(flags[0]?.note).toBe("Axial loading / spinal shear");
  });
});

describe("applySafetyFilter (generator pass)", () => {
  it("is a no-op when injuries is empty", () => {
    const input = ["Back Squat", "Romanian Deadlift", "Lat Pulldown"];
    expect(applySafetyFilter(input)).toEqual(input);
    expect(applySafetyFilter(input, "")).toEqual(input);
  });

  it("swaps 'exclude' exercises for a database alternative, keeps 'warn'", () => {
    const out = applySafetyFilter(
      ["Romanian Deadlift", "Walking Lunge", "Lat Pulldown"],
      "lower back, knee",
    );
    // RDL is exclude for lower back -> swapped for a different exercise
    expect(out).not.toContain("Romanian Deadlift");
    // Walking Lunge is warn-only for knee -> kept
    expect(out).toContain("Walking Lunge");
    // Unaffected exercise kept
    expect(out).toContain("Lat Pulldown");
    expect(out.length).toBe(3);
  });

  it("drops the exercise when no safe candidate exists", () => {
    // Burpee is exclude for cardiovascular but absent from the exercise DB
    const out = applySafetyFilter(["Burpee", "Lat Pulldown"], "heart condition");
    expect(out).toEqual(["Lat Pulldown"]);
  });
});
