import { describe, it, expect } from "vitest";
import {
  parseMethodDefaults,
  notationToPairing,
  rpeForRepRange,
  loadHint,
  deriveExerciseDefaults,
} from "@/lib/methodDefaults";

const GBC = {
  goalTag: "Fat loss / conditioning",
  intensityColor: "green",
  setsReps: "3–4 circuits of 8–12",
  loadPct: "60–70%",
  rest: "30–60s",
  tempo: "4-0-1-0",
  notation: "superset",
  notes: "n",
  durationWeeks: 4,
  frequencyPerWeek: 3,
  idealFor: ["fat loss"],
  contraindications: [],
  periodizationPairings: ["escalating-density-training"],
  preferredCategories: ["pressing"],
};

describe("parseMethodDefaults (Phase 48)", () => {
  it("parses a valid defaults object", () => {
    const d = parseMethodDefaults(GBC);
    expect(d?.goalTag).toBe("Fat loss / conditioning");
    expect(d?.intensityColor).toBe("green");
    expect(d?.notation).toBe("superset");
  });

  it("rejects malformed shapes (callers show 'no defaults', never fabricate)", () => {
    expect(parseMethodDefaults(null)).toBeNull();
    expect(parseMethodDefaults("superset")).toBeNull();
    expect(parseMethodDefaults({ ...GBC, intensityColor: "purple" })).toBeNull();
    expect(parseMethodDefaults({ ...GBC, notation: "weird" })).toBeNull();
    expect(parseMethodDefaults({ ...GBC, setsReps: 42 })).toBeNull();
    expect(parseMethodDefaults({ ...GBC, durationWeeks: "4" })).toBeNull();
  });

  it("tolerates missing optional arrays", () => {
    const d = parseMethodDefaults({ ...GBC, idealFor: "nope", contraindications: undefined });
    expect(d?.idealFor).toEqual([]);
    expect(d?.contraindications).toEqual([]);
  });
});

describe("notationToPairing (Phase 48)", () => {
  it("superset → pairs; triset → triples; straight/complex → null", () => {
    expect(notationToPairing("superset")).toBe("pairs");
    expect(notationToPairing("triset")).toBe("triples");
    expect(notationToPairing("straight")).toBeNull();
    expect(notationToPairing("complex")).toBeNull();
  });
});

describe("rpeForRepRange (Phase 48)", () => {
  it("maps rep ranges to RPE windows", () => {
    expect(rpeForRepRange("3–6")).toBe("RPE 8–9");
    expect(rpeForRepRange("5×5")).toBe("RPE 8–9");
    expect(rpeForRepRange("8–12")).toBe("RPE 6–7");
    expect(rpeForRepRange("10×10")).toBe("RPE 7–8");
    expect(rpeForRepRange("15–20")).toBe("RPE 5–6");
  });
});

describe("loadHint (Phase 48)", () => {
  it("uses %1RM when known, RPE fallback when not", () => {
    expect(loadHint(GBC as never, true)).toBe("start ~60–70% 1RM");
    expect(loadHint(GBC as never, false)).toBe("RPE 6–7 · rest 30–60s");
  });
});

describe("deriveExerciseDefaults (Phase 48)", () => {
  const base = { ...GBC, rest: "30–60s", tempo: "4-0-1-0" } as never;
  it("simple N×M forms", () => {
    expect(deriveExerciseDefaults({ ...base, setsReps: "10×10", rest: "60–90s" })).toEqual({ sets: 10, reps: "10", tempo: "4-0-1-0", rest: "1:00" });
    expect(deriveExerciseDefaults({ ...base, setsReps: "5×5", rest: "2–3 min" })).toEqual({ sets: 5, reps: "5", tempo: "4-0-1-0", rest: "2:00" });
  });
  it("range forms (4–6 × 8–12, GBC circuits)", () => {
    expect(deriveExerciseDefaults({ ...base, setsReps: "4–6 × 8–12" })?.sets).toBe(4);
    expect(deriveExerciseDefaults({ ...base, setsReps: "3–4 circuits of 8–12" })).toEqual({ sets: 3, reps: "8-12", tempo: "4-0-1-0", rest: "0:30" });
  });
  it("triset 'N exercises × C–D' → 3 rounds", () => {
    expect(deriveExerciseDefaults({ ...base, setsReps: "3 exercises × 8–12" })).toEqual({ sets: 3, reps: "8-12", tempo: "4-0-1-0", rest: "0:30" });
  });
  it("unparseable prescriptions → null (no fabricated prefill)", () => {
    expect(deriveExerciseDefaults({ ...base, setsReps: "5/4/3/2/1 ladder" })).toBeNull();
    expect(deriveExerciseDefaults({ ...base, setsReps: "Carries & sleds — variable" })).toBeNull();
    expect(deriveExerciseDefaults({ ...base, setsReps: "To failure + 2–3 mini-sets" })).toBeNull();
  });
});
