import { describe, it, expect } from "vitest";
import { cascadeTargetLoad, createEmptySet, type SessionSet } from "@/lib/workoutSession";

const set = (n: number, clientLoad: number, done = false): SessionSet =>
  createEmptySet(n, { clientLoad, load: clientLoad, done });

describe("cascadeTargetLoad (Phase 33E)", () => {
  it("0 → 50 cascades 50 to every unfinished set (multi-digit follow-through)", () => {
    const sets = [set(1, 0), set(2, 0), set(3, 0), set(4, 0)];
    // first keystroke
    const after5 = cascadeTargetLoad(sets, 0, 5);
    expect(after5.map((s) => s.clientLoad)).toEqual([5, 5, 5, 5]);
    // second keystroke — the 33E bug dropped this update before the fix
    const after50 = cascadeTargetLoad(after5, 5, 50);
    expect(after50.map((s) => s.clientLoad)).toEqual([50, 50, 50, 50]);
    expect(after50.map((s) => s.load)).toEqual([50, 50, 50, 50]);
  });

  it("50 → 55 updates sets still at 50 and preserves a manually-set 45", () => {
    const sets = [set(1, 50), set(2, 50), set(3, 45), set(4, 50)];
    const out = cascadeTargetLoad(sets, 50, 55);
    expect(out.map((s) => s.clientLoad)).toEqual([55, 55, 45, 55]);
  });

  it("done sets are never touched, even when they equal the previous target", () => {
    const sets = [set(1, 50, true), set(2, 50), set(3, 0)];
    const out = cascadeTargetLoad(sets, 50, 55);
    expect(out[0].clientLoad).toBe(50); // done — untouched
    expect(out[0].done).toBe(true);
    expect(out[1].clientLoad).toBe(55);
    expect(out[2].clientLoad).toBe(55);
  });

  it("does not touch diverged sets (value ≠ previous target)", () => {
    const sets = [set(1, 30), set(2, 50)];
    const out = cascadeTargetLoad(sets, 50, 55);
    expect(out[0].clientLoad).toBe(30); // diverged — preserved
    expect(out[1].clientLoad).toBe(55);
  });
});
