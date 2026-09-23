/* Phase 99c Item 4 — blueprintNutritionGuide unit tests. */
import { describe, expect, it } from "vitest";
import { buildNutritionGuide } from "./blueprintNutritionGuide";

const cut = { isFatLoss: true, targetKcal: 1600, maintenanceKcal: 2200, clampedByFloor: false, proteinG: 150, dietBreak: true };
const bulk = { isFatLoss: false, targetKcal: 2500, maintenanceKcal: 2300, clampedByFloor: false, proteinG: 170, dietBreak: false };

describe("buildNutritionGuide", () => {
  it("fat-loss guide names the real deficit and protein target", () => {
    const g = buildNutritionGuide(cut);
    expect(g.title).toContain("1,600");
    expect(g.title).toContain("27%"); // 600/2200
    expect(g.blocks[0].points[0]).toContain("150 g/day");
    expect(g.safetyCallout).toBeNull();
  });

  it("loud safety callout when the target was clamped by the floor", () => {
    const g = buildNutritionGuide({ ...cut, clampedByFloor: true });
    expect(g.safetyCallout).not.toBeNull();
    expect(g.safetyCallout).toMatch(/safety floor/);
  });

  it("diet-break variant switches copy when dietBreak is false", () => {
    const g = buildNutritionGuide({ ...cut, dietBreak: false });
    const block = g.blocks.find((b) => b.heading.startsWith("Diet breaks"))!;
    expect(block.points[0]).toMatch(/tell the coach early/);
  });

  it("non-fat-loss variant never reads like a cut", () => {
    const g = buildNutritionGuide(bulk);
    expect(g.intro).toMatch(/NOT dieting/);
    expect(g.blocks.some((b) => b.heading.includes("hungry") || b.heading.includes("Volume"))).toBe(false);
  });

  it("always carries the who-should-not-cut list", () => {
    expect(buildNutritionGuide(cut).whoShouldNotCut.length).toBeGreaterThanOrEqual(4);
    expect(buildNutritionGuide(bulk).whoShouldNotCut.length).toBeGreaterThanOrEqual(4);
  });

  it("notes honestly when the deficit is unusually small", () => {
    const g = buildNutritionGuide({ ...cut, targetKcal: 2050 }); // ~7% deficit
    expect(g.notes.join(" ")).toMatch(/under 10%/);
  });
});
