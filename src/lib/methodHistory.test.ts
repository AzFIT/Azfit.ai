import { describe, it, expect } from "vitest";
import { programUsesMethod, entryVolumeKg, summarizeMethodHistory } from "./methodHistory";

describe("programUsesMethod (phases[0].method slug, Phase 48 persistence)", () => {
  it("matches the slug anywhere in the phases array", () => {
    expect(programUsesMethod([{ name: "Accumulation", method: "german-volume-training-10x10" }], "german-volume-training-10x10")).toBe(true);
    expect(programUsesMethod([{ name: "x" }, { method: "wave-loading" }], "wave-loading")).toBe(true);
  });

  it("rejects misses and malformed inputs", () => {
    expect(programUsesMethod([{ method: "gvt" }], "wave-loading")).toBe(false);
    expect(programUsesMethod(null, "gvt")).toBe(false);
    expect(programUsesMethod("not-an-array", "gvt")).toBe(false);
    expect(programUsesMethod([{ method: "gvt" }], "")).toBe(false);
    expect(programUsesMethod([{ method: 42 }], "gvt")).toBe(false);
  });
});

describe("entryVolumeKg (Σ weight×reps, min-pairing)", () => {
  it("sums paired sets; skips partial pairs and non-numeric entries", () => {
    expect(entryVolumeKg({ weight_per_set: [100, 100, 100], reps_per_set: [10, 10, 10] })).toBe(3000);
    expect(entryVolumeKg({ weight_per_set: [100, 100], reps_per_set: [10] })).toBe(1000);
    expect(entryVolumeKg({ weight_per_set: [100, "x"], reps_per_set: [10, 10] })).toBe(1000);
    expect(entryVolumeKg({ weight_per_set: null, reps_per_set: null })).toBe(0);
  });
});

describe("summarizeMethodHistory (chronological, honest nulls)", () => {
  it("empty → zero sessions, all nulls", () => {
    expect(summarizeMethodHistory([])).toEqual({
      sessionsCompleted: 0,
      firstVolumeKg: null,
      lastVolumeKg: null,
      volumeChangePct: null,
    });
  });

  it("one session → no percentage", () => {
    const s = summarizeMethodHistory([{ completedAt: "2026-08-01T10:00:00Z", volumeKg: 5000 }]);
    expect(s).toEqual({ sessionsCompleted: 1, firstVolumeKg: 5000, lastVolumeKg: 5000, volumeChangePct: null });
  });

  it("sorts chronologically and computes the first→last volume change", () => {
    const s = summarizeMethodHistory([
      { completedAt: "2026-08-10T10:00:00Z", volumeKg: 6000 },
      { completedAt: "2026-08-01T10:00:00Z", volumeKg: 5000 },
      { completedAt: "2026-08-20T10:00:00Z", volumeKg: 7000 },
    ]);
    expect(s.sessionsCompleted).toBe(3);
    expect(s.firstVolumeKg).toBe(5000);
    expect(s.lastVolumeKg).toBe(7000);
    expect(s.volumeChangePct).toBe(40); // (7000-5000)/5000
  });

  it("null percentage when the first session has zero volume; negative changes work", () => {
    expect(
      summarizeMethodHistory([
        { completedAt: "2026-08-01T10:00:00Z", volumeKg: 0 },
        { completedAt: "2026-08-02T10:00:00Z", volumeKg: 100 },
      ]).volumeChangePct,
    ).toBeNull();
    expect(
      summarizeMethodHistory([
        { completedAt: "2026-08-01T10:00:00Z", volumeKg: 5000 },
        { completedAt: "2026-08-02T10:00:00Z", volumeKg: 4000 },
      ]).volumeChangePct,
    ).toBe(-20);
  });

  it("skips sessions with unparseable dates", () => {
    const s = summarizeMethodHistory([
      { completedAt: "not-a-date", volumeKg: 9999 },
      { completedAt: "2026-08-01T10:00:00Z", volumeKg: 5000 },
    ]);
    expect(s.sessionsCompleted).toBe(1);
    expect(s.firstVolumeKg).toBe(5000);
  });
});
