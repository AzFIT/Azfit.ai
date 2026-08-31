import { describe, it, expect } from "vitest";
import { endTimeFromDuration, durationFromTimes, nearestDurationOption, DURATION_OPTIONS } from "./sessionDuration";

describe("endTimeFromDuration", () => {
  it("derives the end from start + duration", () => {
    expect(endTimeFromDuration("09:00", 60)).toBe("10:00");
    expect(endTimeFromDuration("09:00", 30)).toBe("09:30");
    expect(endTimeFromDuration("09:00", 45)).toBe("09:45");
    expect(endTimeFromDuration("09:00", 90)).toBe("10:30");
    expect(endTimeFromDuration("21:30", 90)).toBe("23:00");
  });
  it("junk input → empty string", () => {
    expect(endTimeFromDuration("bad", 60)).toBe("");
    expect(endTimeFromDuration("09:00", NaN)).toBe("");
  });
});

describe("durationFromTimes (edit-prefill path)", () => {
  it("computes durations back", () => {
    expect(durationFromTimes("09:00", "10:00")).toBe(60);
    expect(durationFromTimes("09:15", "10:00")).toBe(45);
    expect(durationFromTimes("18:30", "20:00")).toBe(90);
  });
  it("end before start → 0 (never negative)", () => {
    expect(durationFromTimes("10:00", "09:00")).toBe(0);
  });
});

describe("nearestDurationOption", () => {
  it("exact chip wins; in-between picks nearest", () => {
    expect(nearestDurationOption(60)).toBe(60);
    expect(nearestDurationOption(50)).toBe(45);
    expect(nearestDurationOption(75)).toBe(60);
    expect(nearestDurationOption(120)).toBe(90);
    expect(nearestDurationOption(15)).toBe(30);
  });
  it("every option round-trips", () => {
    for (const opt of DURATION_OPTIONS) expect(nearestDurationOption(opt)).toBe(opt);
  });
});
