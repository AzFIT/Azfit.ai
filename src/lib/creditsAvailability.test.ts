import { describe, it, expect } from "vitest";
import {
  remainingCredits,
  isWithinAvailability,
  hasAvailabilityTemplate,
  weekdayOf,
} from "@/lib/creditsAvailability";

const pkg = (id: string, total: number, created: string) => ({
  id,
  total_credits: total,
  created_at: created,
});
const sess = (status: string, created: string) => ({ status, created_at: created });

describe("remainingCredits (Phase 50)", () => {
  const p12 = pkg("a", 12, "2026-08-01T00:00:00Z");

  it("single package: total minus scheduled/completed sessions since creation", () => {
    const sessions = [sess("scheduled", "2026-08-03T10:00:00Z"), sess("completed", "2026-08-04T10:00:00Z")];
    expect(remainingCredits([p12], sessions)).toBe(10);
  });

  it("cancelled sessions never consume credits", () => {
    const sessions = [sess("cancelled", "2026-08-03T10:00:00Z"), sess("scheduled", "2026-08-04T10:00:00Z")];
    expect(remainingCredits([p12], sessions)).toBe(11);
  });

  it("sessions BEFORE the earliest package don't count", () => {
    const sessions = [sess("completed", "2026-07-20T10:00:00Z"), sess("scheduled", "2026-08-02T10:00:00Z")];
    expect(remainingCredits([p12], sessions)).toBe(11);
  });

  it("multiple packages pool: sums total, counts since the EARLIEST package", () => {
    const a = pkg("a", 12, "2026-08-01T00:00:00Z");
    const b = pkg("b", 6, "2026-08-04T00:00:00Z");
    const sessions = [sess("completed", "2026-08-03T10:00:00Z"), sess("scheduled", "2026-08-05T10:00:00Z")];
    expect(remainingCredits([a, b], sessions)).toBe(16); // 18 − 2 (no double-charge)
  });

  it("floors at 0 and returns 0 with no packages", () => {
    expect(remainingCredits([pkg("a", 1, "2026-08-01T00:00:00Z")], [sess("scheduled", "2026-08-02T00:00:00Z"), sess("scheduled", "2026-08-03T00:00:00Z")])).toBe(0);
    expect(remainingCredits([], [sess("scheduled", "2026-08-02T00:00:00Z")])).toBe(0);
  });
});

describe("availability containment (Phase 50)", () => {
  const windows = [{ weekday: 1, start_time: "06:00", end_time: "10:00" }];

  it("Monday-first weekday mapping", () => {
    expect(weekdayOf("2026-08-03")).toBe(1); // Monday
    expect(weekdayOf("2026-08-09")).toBe(7); // Sunday
    expect(weekdayOf("2026-08-05")).toBe(3); // Wednesday
  });

  it("start-time containment within the window", () => {
    expect(isWithinAvailability(windows, [], "2026-08-03", "06:00")).toBe(true);
    expect(isWithinAvailability(windows, [], "2026-08-03", "09:30")).toBe(true);
    expect(isWithinAvailability(windows, [], "2026-08-03", "10:00")).toBe(false); // end exclusive
    expect(isWithinAvailability(windows, [], "2026-08-03", "05:30")).toBe(false);
    expect(isWithinAvailability(windows, [], "2026-08-04", "07:00")).toBe(false); // wrong day
  });

  it("blocked dates always fail; empty template = no opinion", () => {
    expect(isWithinAvailability(windows, ["2026-08-03"], "2026-08-03", "07:00")).toBe(false);
    expect(hasAvailabilityTemplate([], [])).toBe(false);
    expect(hasAvailabilityTemplate(windows, [])).toBe(true);
    expect(hasAvailabilityTemplate([], ["2026-08-21"])).toBe(true);
  });
});
