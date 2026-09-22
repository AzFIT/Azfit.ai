import { describe, it, expect } from "vitest";
import {
  calculateJP3,
  calculateJP7,
  siriBodyFatPct,
  calculateBMRKatchMcArdle,
  calculateBodyFat,
  getProtocolSites,
  sumSites,
  type SkinfoldSite,
} from "./bodyfat";

describe("JP3 gender-specific site sets (98b fix)", () => {
  it("male jp3 = chest/abdomen/thigh", () => {
    expect(getProtocolSites("jp3", "male")).toEqual(["pec", "umbilical", "mid_thigh"]);
  });
  it("female jp3 = triceps/supra-iliac/thigh", () => {
    expect(getProtocolSites("jp3", "female")).toEqual(["triceps", "supra_iliac", "mid_thigh"]);
  });
  it("jp7 and poliquin12 are sex-independent", () => {
    expect(getProtocolSites("jp7", "male")).toEqual(getProtocolSites("jp7", "female"));
    expect(getProtocolSites("poliquin12", "male")).toEqual(getProtocolSites("poliquin12", "female"));
  });
  it("sumSites sums the sex-correct sites — female pec value is ignored", () => {
    const sites: Partial<Record<SkinfoldSite, number>> = {
      pec: 99, // male chest fold — must NOT count for a female jp3
      triceps: 15,
      supra_iliac: 12,
      mid_thigh: 23,
    };
    expect(sumSites(sites, "jp3", "female")).toBe(50);
    expect(sumSites(sites, "jp3", "male")).toBe(99 + 23); // pec + mid_thigh (umbilical 0)
  });
});

describe("known-answer math locks", () => {
  it("jp3 male S=51 age 25 → BD ≈ 1.0649, BF ≈ 14.8%", () => {
    const bd = calculateJP3(51, 25, "male");
    expect(bd).toBeCloseTo(1.0649, 4);
    expect(siriBodyFatPct(bd)).toBeCloseTo(14.8, 1);
  });
  it("jp3 female S=50 age 30 → BD ≈ 1.0514, BF ≈ 20.8%", () => {
    const bd = calculateJP3(50, 30, "female");
    expect(bd).toBeCloseTo(1.0514, 4);
    expect(siriBodyFatPct(bd)).toBeCloseTo(20.8, 1);
  });
  it("jp7 male S=120 age 35 → BD ≈ 1.0576, BF ≈ 18.0%", () => {
    const bd = calculateJP7(120, 35, "male");
    expect(bd).toBeCloseTo(1.0576, 4);
    expect(siriBodyFatPct(bd)).toBeCloseTo(18.0, 1);
  });
  it("Siri(1.0649) ≈ 14.8", () => {
    expect(siriBodyFatPct(1.0649)).toBeCloseTo(14.8, 1);
  });
  it("Katch-McArdle(15%, 80 kg) = 1838.8", () => {
    expect(calculateBMRKatchMcArdle(15, 80)).toBeCloseTo(1838.8, 1);
  });
});

describe("poliquin12 stays sum-only (honest null)", () => {
  it("returns sum with no density / body-fat score", () => {
    const r = calculateBodyFat("poliquin12", 150, 40, "male");
    expect(r.sumMm).toBe(150);
    expect(r.bodyDensity).toBeNull();
    expect(r.bodyFatPct).toBeNull();
  });
});
