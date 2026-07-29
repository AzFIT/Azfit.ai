import { describe, it, expect } from "vitest";
import { suggestPhasesForMethod } from "@/lib/phaseSuggestions";

describe("suggestPhasesForMethod (Phase 30B)", () => {
  it("GVT / 10x10 / GBC → single 6-week Accumulation", () => {
    for (const m of ["German Volume Training (10x10)", "german-volume-training-10x10", "german-volume", "GBC (German Body Composition)", "10x10"]) {
      const s = suggestPhasesForMethod(m);
      expect(s).toHaveLength(1);
      expect(s![0]).toMatchObject({ name: "Accumulation", weeks: 6 });
    }
  });

  it("5x5 / stronglift → Foundation + Intensification", () => {
    for (const m of ["5x5 Stronglifts", "5x5", "Stronglift 5x5"]) {
      const s = suggestPhasesForMethod(m);
      expect(s).toHaveLength(2);
      expect(s!.map((p) => p.name)).toEqual(["Foundation", "Intensification"]);
    }
  });

  it("triphasic / conjugate → 3-phase classic block", () => {
    for (const m of ["Triphasic Training", "triphasic", "Conjugate Method", "conjugate"]) {
      const s = suggestPhasesForMethod(m);
      expect(s).toHaveLength(3);
      expect(s!.map((p) => p.name)).toEqual(["Accumulation", "Intensification", "Realization"]);
    }
  });

  it("unknown / empty methods → null (keep current phases)", () => {
    expect(suggestPhasesForMethod("Circuit Conditioning")).toBeNull();
    expect(suggestPhasesForMethod("")).toBeNull();
    expect(suggestPhasesForMethod("wave-loading")).toBeNull();
  });
});
