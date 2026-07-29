import { describe, it, expect } from "vitest";
import {
  pairingStyleForMethod,
  assignPairGroups,
  stripPairing,
  groupLetter,
} from "@/lib/supersets";

describe("pairingStyleForMethod (Phase 30C)", () => {
  it("Supersets / GBC / GVT → pairs", () => {
    expect(pairingStyleForMethod("Supersets")).toBe("pairs");
    expect(pairingStyleForMethod("supersets")).toBe("pairs");
    expect(pairingStyleForMethod("GBC (German Body Composition)")).toBe("pairs");
    expect(pairingStyleForMethod("German Volume Training (10x10)")).toBe("pairs");
    expect(pairingStyleForMethod("german-volume")).toBe("pairs");
  });

  it("Trisets → triples; Circuits / Giant Sets → circuit", () => {
    expect(pairingStyleForMethod("Trisets")).toBe("triples");
    expect(pairingStyleForMethod("Circuit Conditioning")).toBe("circuit");
    expect(pairingStyleForMethod("Giant Sets")).toBe("circuit");
  });

  it("non-pairing methods → null", () => {
    expect(pairingStyleForMethod("5x5 Stronglifts")).toBeNull();
    expect(pairingStyleForMethod("Wave Loading")).toBeNull();
    expect(pairingStyleForMethod("")).toBeNull();
  });
});

describe("assignPairGroups / stripPairing", () => {
  const list = [{ name: "e1" }, { name: "e2" }, { name: "e3" }, { name: "e4" }, { name: "e5" }];

  it("pairs: A,A,B,B,C", () => {
    expect(assignPairGroups(list, "pairs").map((e) => e.supersetGroup)).toEqual(["A", "A", "B", "B", "C"]);
  });

  it("triples: A,A,A,B,B", () => {
    expect(assignPairGroups(list, "triples").map((e) => e.supersetGroup)).toEqual(["A", "A", "A", "B", "B"]);
  });

  it("circuit: all A", () => {
    expect(assignPairGroups(list, "circuit").map((e) => e.supersetGroup)).toEqual(["A", "A", "A", "A", "A"]);
  });

  it("group letters cap at H", () => {
    expect(groupLetter(0)).toBe("A");
    expect(groupLetter(7)).toBe("H");
    expect(groupLetter(12)).toBe("H");
  });

  it("does not mutate the input and stripPairing removes groups", () => {
    const paired = assignPairGroups(list, "pairs");
    expect(list[0]).not.toHaveProperty("supersetGroup");
    const stripped = stripPairing(paired);
    expect(stripped[0]).not.toHaveProperty("supersetGroup");
    expect(stripped.map((e) => e.name)).toEqual(["e1", "e2", "e3", "e4", "e5"]);
  });
});
