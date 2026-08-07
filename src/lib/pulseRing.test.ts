import { describe, it, expect } from "vitest";
import { clampPercent, ringGeometry, ringDashOffset } from "./pulseRing";

describe("clampPercent", () => {
  it("passes through in-range values", () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(42.5)).toBe(42.5);
    expect(clampPercent(100)).toBe(100);
  });
  it("clamps out-of-range", () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(250)).toBe(100);
  });
  it("NaN/Infinity → 0 (never a broken arc)", () => {
    expect(clampPercent(NaN)).toBe(0);
    expect(clampPercent(Infinity)).toBe(0);
    expect(clampPercent(-Infinity)).toBe(0);
  });
});

describe("ringGeometry", () => {
  it("radius = (size - strokeWidth) / 2, circumference = 2πr", () => {
    const g = ringGeometry(120, 10);
    expect(g.radius).toBe(55);
    expect(g.circumference).toBeCloseTo(2 * Math.PI * 55, 6);
  });
});

describe("ringDashOffset", () => {
  const C = 2 * Math.PI * 55;
  it("0% → full offset (empty ring)", () => {
    expect(ringDashOffset(0, C)).toBeCloseTo(C, 6);
  });
  it("50% → half offset", () => {
    expect(ringDashOffset(50, C)).toBeCloseTo(C / 2, 6);
  });
  it("100% → zero offset (full ring)", () => {
    expect(ringDashOffset(100, C)).toBeCloseTo(0, 6);
  });
  it("clamps before computing (120% → full ring, never overshoot)", () => {
    expect(ringDashOffset(120, C)).toBeCloseTo(0, 6);
    expect(ringDashOffset(-10, C)).toBeCloseTo(C, 6);
  });
});
