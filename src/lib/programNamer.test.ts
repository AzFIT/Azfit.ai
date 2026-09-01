import { describe, it, expect } from "vitest";
import { dateStampDdMmYy, programNameVariants, randomProgramName } from "./programNamer";

const DATE = new Date(2026, 8, 1); // 1 Sep 2026

describe("programNamer (Phase 66 Item 2b)", () => {
  it("formats the creation date as DD/MM/YY, zero-padded", () => {
    expect(dateStampDdMmYy(DATE)).toBe("01/09/26");
    expect(dateStampDdMmYy(new Date(2026, 11, 25))).toBe("25/12/26");
  });

  it("goal word banks are goal-correct — endurance never yields hypertrophy names", () => {
    const variants = programNameVariants(["endurance"], [], null);
    expect(variants).toContain("Engine Builder");
    expect(variants.join(" ")).not.toMatch(/hypertrophy|muscle|size/i);
    expect(programNameVariants(["hypertrophy"], [], null)[0]).toBe("Hypertrophy Block");
    expect(programNameVariants(["fatloss"], [], null)[0]).toBe("Shred Block");
  });

  it("method-derived word follows the goal bank; parens stripped", () => {
    const variants = programNameVariants(["hypertrophy"], [], "German Volume Training (10×10)");
    expect(variants[0]).toBe("Hypertrophy Block");
    expect(variants).toContain("German Volume Training Block");
  });

  it("custom goals contribute their own name; empty everything falls back to 'Program'", () => {
    expect(programNameVariants([], ["Marathon Prep"], null)).toContain("Marathon Prep Block");
    expect(programNameVariants([], [], null)).toEqual(["Program"]);
  });

  it("clicks cycle deterministically through variants and append the date stamp", () => {
    const first = randomProgramName(["strength"], [], null, 0, DATE);
    const second = randomProgramName(["strength"], [], null, 1, DATE);
    expect(first).toBe("Strength Cycle 01/09/26");
    expect(second).toBe("Strength Block 01/09/26");
    // wraps around the variant list
    expect(randomProgramName(["strength"], [], null, 3, DATE)).toBe(first);
  });
});
