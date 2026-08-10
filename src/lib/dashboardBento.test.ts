import { describe, it, expect } from "vitest";
import {
  wowDeltaPct,
  weeklyComplianceShare,
  weeklyVolumeByDay,
  formatVolumeKg,
  initialsOf,
  timelineChip,
} from "./dashboardBento";

describe("wowDeltaPct", () => {
  it("computes rounded percent deltas", () => {
    expect(wowDeltaPct(6, 4)).toBe(50);
    expect(wowDeltaPct(2, 4)).toBe(-50);
    expect(wowDeltaPct(4, 4)).toBe(0);
  });
  it("null when no honest basis (prev 0 / null / undefined)", () => {
    expect(wowDeltaPct(3, 0)).toBeNull();
    expect(wowDeltaPct(3, null)).toBeNull();
    expect(wowDeltaPct(3, undefined)).toBeNull();
  });
  it("null on garbage input", () => {
    expect(wowDeltaPct(NaN, 4)).toBeNull();
    expect(wowDeltaPct(-1, 4)).toBeNull();
  });
});

describe("weeklyComplianceShare", () => {
  it("completed / non-cancelled, rounded", () => {
    expect(weeklyComplianceShare([{ status: "completed" }, { status: "scheduled" }])).toBe(50);
    expect(weeklyComplianceShare([{ status: "completed" }, { status: "cancelled" }])).toBe(100);
  });
  it("null when nothing but cancelled / empty", () => {
    expect(weeklyComplianceShare([])).toBeNull();
    expect(weeklyComplianceShare([{ status: "cancelled" }])).toBeNull();
  });
});

describe("weeklyVolumeByDay", () => {
  it("buckets weight×reps by weekday (Mon=0)", () => {
    // 2026-08-03 is a Monday, 2026-08-05 a Wednesday
    const rows = [
      { completed_at: "2026-08-03T10:00:00", weight_per_set: [60, 60], reps_per_set: [8, 8] }, // 960 Mon
      { completed_at: "2026-08-05T10:00:00", weight_per_set: [80], reps_per_set: [6] }, // 480 Wed
    ];
    const r = weeklyVolumeByDay(rows);
    expect(r.dayTotals[0]).toBe(960);
    expect(r.dayTotals[2]).toBe(480);
    expect(r.total).toBe(1440);
    expect(r.max).toBe(960);
    expect(r.maxDayIdx).toBe(0);
  });
  it("pairs min(set arrays) and skips non-numeric/partial sets", () => {
    const r = weeklyVolumeByDay([
      { completed_at: "2026-08-03T10:00:00", weight_per_set: [60, 60, 60], reps_per_set: [8, 8] },
      { completed_at: "2026-08-03T11:00:00", weight_per_set: null, reps_per_set: null },
      { completed_at: "bad-date", weight_per_set: [100], reps_per_set: [10] },
    ]);
    expect(r.dayTotals[0]).toBe(960);
    expect(r.total).toBe(960);
  });
  it("all-zero → maxDayIdx -1 and formatVolumeKg null", () => {
    const r = weeklyVolumeByDay([]);
    expect(r.maxDayIdx).toBe(-1);
    expect(formatVolumeKg(r.total)).toBeNull();
  });
});

describe("formatVolumeKg", () => {
  it("formats thousands with one decimal", () => {
    expect(formatVolumeKg(18432)).toBe("18.4k kg");
    expect(formatVolumeKg(850)).toBe("850 kg");
  });
  it("zero/negative/NaN → null", () => {
    expect(formatVolumeKg(0)).toBeNull();
    expect(formatVolumeKg(NaN)).toBeNull();
  });
});

describe("initialsOf", () => {
  it("first letters of first two words, uppercased", () => {
    expect(initialsOf("Jonny Mclarnon")).toBe("JM");
    expect(initialsOf("HK")).toBe("HK");
    expect(initialsOf("  ")).toBe("?");
  });
});

describe("timelineChip mapping", () => {
  it("completed → Confirmed; scheduled → Pending; check-in due overrides Pending", () => {
    expect(timelineChip("completed", false)).toBe("Confirmed");
    expect(timelineChip("scheduled", false)).toBe("Pending");
    expect(timelineChip("scheduled", true)).toBe("Check-in due");
    expect(timelineChip("completed", true)).toBe("Confirmed");
  });
});
