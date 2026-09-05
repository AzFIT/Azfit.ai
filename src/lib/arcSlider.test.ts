import { describe, it, expect } from "vitest";
import {
  arcGeometry,
  pointForAngle,
  clampValue,
  snapToStep,
  angleForValue,
  angleFromPoint,
  valueForAngle,
  formatArcValue,
  arcEndpoints,
  arcPath,
} from "./arcSlider";

const G = arcGeometry(200, 12, 240);

describe("arcSlider geometry (clockwise-from-top convention)", () => {
  it("centers and insets the radius by the stroke", () => {
    expect(G.cx).toBe(100);
    expect(G.cy).toBe(100);
    expect(G.r).toBe(92);
    expect(G.span).toBe(240);
  });

  it("pointForAngle: top/right/bottom/left land on the compass points", () => {
    expect(pointForAngle(G, 0)).toEqual({ x: 100, y: 8 });
    expect(pointForAngle(G, 90).x).toBeCloseTo(192);
    expect(pointForAngle(G, 90).y).toBeCloseTo(100);
    expect(pointForAngle(G, -120).x).toBeCloseTo(100 - 92 * Math.sin(Math.PI * 2 / 3));
  });

  it("angleForValue maps min→-span/2, max→+span/2, mid→0", () => {
    expect(angleForValue(0, 0, 12, 240)).toBe(-120);
    expect(angleForValue(12, 0, 12, 240)).toBe(120);
    expect(angleForValue(6, 0, 12, 240)).toBe(0);
    // out-of-range values clamp to the ends
    expect(angleForValue(-5, 0, 12, 240)).toBe(-120);
    expect(angleForValue(99, 0, 12, 240)).toBe(120);
  });
});

describe("arcSlider value math", () => {
  it("clampValue + snapToStep hit exact boundaries", () => {
    expect(clampValue(-1, 0, 10)).toBe(0);
    expect(clampValue(11, 0, 10)).toBe(10);
    expect(snapToStep(7.26, 0, 12, 0.5)).toBe(7.5);
    expect(snapToStep(7.24, 0, 12, 0.5)).toBe(7);
    expect(snapToStep(2460, 0, 5000, 100)).toBe(2500);
    expect(snapToStep(2449, 0, 5000, 100)).toBe(2400);
    expect(snapToStep(4999, 0, 5000, 100)).toBe(5000);
    // step 0 is a pass-through clamp, never a divide-by-zero
    expect(snapToStep(3.3, 0, 10, 0)).toBe(3.3);
  });

  it("valueForAngle: ends, mid, and bottom-gap clamping", () => {
    expect(valueForAngle(-120, 0, 12, 240, 0.5)).toBe(0);
    expect(valueForAngle(120, 0, 12, 240, 0.5)).toBe(12);
    expect(valueForAngle(0, 0, 12, 240, 0.5)).toBe(6);
    // bottom gap (|angle| > span/2) clamps to the nearest end
    expect(valueForAngle(170, 0, 12, 240, 0.5)).toBe(12);
    expect(valueForAngle(-170, 0, 12, 240, 0.5)).toBe(0);
  });

  it("angleFromPoint round-trips with angleForValue", () => {
    const pt = pointForAngle(G, 60);
    expect(angleFromPoint(pt.x, pt.y, G)).toBeCloseTo(60);
    const v = valueForAngle(angleFromPoint(pt.x, pt.y, G), 0, 12, 240, 0.5);
    expect(v).toBe(9); // 60° of 240° span = 75% → 9
  });

  it("formatArcValue uses step-appropriate decimals", () => {
    expect(formatArcValue(7.5, 0.5)).toBe("7.5");
    expect(formatArcValue(2500, 100)).toBe("2500");
    expect(formatArcValue(8, 1)).toBe("8");
  });

  it("arcPath/arcEndpoints produce a valid sweep path", () => {
    const { start, end } = arcEndpoints(G);
    expect(start.x).toBeLessThan(G.cx); // min end sits left
    expect(end.x).toBeGreaterThan(G.cx); // max end sits right
    expect(start.y).toBeCloseTo(end.y); // symmetric about the top
    expect(arcPath(G, 0)).toMatch(/ 0 0 1 /); // 120° sweep → small-arc flag
    expect(arcPath(G, 120)).toMatch(/ 0 1 1 /); // full span uses the large-arc flag
  });
});
