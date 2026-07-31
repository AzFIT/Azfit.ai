import { describe, it, expect } from "vitest";
import {
  parseOrderLabel,
  normalizeOrderLabels,
  nextSeriesLetter,
  labelsForPairAdd,
  labelsAfterRemove,
} from "@/lib/exerciseLabels";

describe("parseOrderLabel", () => {
  it("parses letters and numbers", () => {
    expect(parseOrderLabel("A1")).toEqual({ letter: "A", num: 1 });
    expect(parseOrderLabel("E")).toEqual({ letter: "E", num: null });
    expect(parseOrderLabel("D2")).toEqual({ letter: "D", num: 2 });
  });
});

describe("normalizeOrderLabels (Phase 33C Fix 4a)", () => {
  it("repairs duplicate letters (owner's D1 D1 case)", () => {
    expect(
      normalizeOrderLabels(["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D1"])
    ).toEqual(["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"]);
  });

  it("collapses a singleton numbered series to the plain letter", () => {
    expect(normalizeOrderLabels(["A1", "B1", "C2"])).toEqual(["A", "B", "C"]);
  });

  it("keeps a proper series intact", () => {
    expect(normalizeOrderLabels(["A1", "A2", "B"])).toEqual(["A1", "A2", "B"]);
  });
});

describe("labelsForPairAdd (smart add — pair with last series)", () => {
  it("singleton E becomes E1, new exercise E2", () => {
    const { updated, newLabel } = labelsForPairAdd(["A1", "A2", "B"]);
    expect(updated).toEqual(["A1", "A2", "B1"]);
    expect(newLabel).toBe("B2");
  });

  it("existing series grows by one", () => {
    const { updated, newLabel } = labelsForPairAdd(["A1", "A2", "B1", "B2"]);
    expect(updated).toEqual(["A1", "A2", "B1", "B2"]);
    expect(newLabel).toBe("B3");
  });

  it("empty list starts at A", () => {
    expect(labelsForPairAdd([])).toEqual({ updated: [], newLabel: "A" });
  });
});

describe("nextSeriesLetter (smart add — new series)", () => {
  it("one past the highest letter", () => {
    expect(nextSeriesLetter(["A1", "A2", "B"])).toBe("C");
    expect(nextSeriesLetter([])).toBe("A");
    expect(nextSeriesLetter(["Y1"])).toBe("Z");
  });
});

describe("labelsAfterRemove", () => {
  it("removing one of a pair renames the survivor to the plain letter", () => {
    expect(labelsAfterRemove(["A", "B1", "B2"], 1)).toEqual(["A", "B"]);
    expect(labelsAfterRemove(["A", "B1", "B2"], 2)).toEqual(["A", "B"]);
  });

  it("removing from a 3-series renumbers the rest", () => {
    expect(labelsAfterRemove(["C1", "C2", "C3"], 1)).toEqual(["C1", "C2"]);
  });
});
