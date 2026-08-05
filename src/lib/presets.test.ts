import { describe, it, expect } from "vitest";
import { SETS_PRESETS, REPS_PRESETS, TEMPO_PRESETS } from "@/lib/presets";
import { nextOrderIndex } from "@/lib/exerciseLabels";

describe("prescription preset lists (Phase 41)", () => {
  it("sets presets match the spec", () => {
    expect(SETS_PRESETS).toEqual(["1", "2", "3", "4", "5", "6", "8", "10", "12"]);
  });

  it("reps presets match the spec", () => {
    expect(REPS_PRESETS).toEqual([
      "1-3", "3-5", "5-8", "6-8", "8-10", "8-12", "10-12", "12-15", "15-20", "20-30", "AMRAP",
    ]);
  });

  it("tempo presets match the spec", () => {
    expect(TEMPO_PRESETS).toEqual([
      "2-0-1-0", "2-0-2-0", "3-0-1-0", "3-1-1-0", "4-0-1-0", "4-2-1-0", "1-0-1-0", "Explosive",
    ]);
  });
});

describe("nextOrderIndex (Phase 41 duplicate)", () => {
  it("is one past the highest existing index", () => {
    expect(nextOrderIndex([0, 1, 2, 7])).toBe(8);
  });

  it("ignores null/undefined entries (legacy rows)", () => {
    expect(nextOrderIndex([null, 3, undefined, 1])).toBe(4);
  });

  it("empty day starts at 0", () => {
    expect(nextOrderIndex([])).toBe(0);
    expect(nextOrderIndex([null, undefined])).toBe(0);
  });
});
