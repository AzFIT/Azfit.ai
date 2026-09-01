import { describe, it, expect } from "vitest";
import { phaseGuidanceFor, phaseDisplayName } from "./phaseGuidance";

describe("phaseGuidance (Phase 66 Item 1) — display-only plain labels", () => {
  it("maps the three classic phases + Adaptation, case-insensitively", () => {
    expect(phaseGuidanceFor("Accumulation")?.plain).toBe("Build Phase");
    expect(phaseGuidanceFor("Intensification")?.plain).toBe("Push Phase");
    expect(phaseGuidanceFor("Realization")?.plain).toBe("Peak Phase");
    expect(phaseGuidanceFor("Adaptation")?.plain).toBe("Foundation Phase");
    expect(phaseGuidanceFor("accumulation")?.classic).toBe("Accumulation");
  });

  it("keeps the classic term as subtitle and carries a guidance description", () => {
    const g = phaseGuidanceFor("Accumulation");
    expect(g?.classic).toBe("Accumulation");
    expect(g?.description.length).toBeGreaterThan(80); // 2–3 sentences of real copy
    expect(g?.description).toContain("volume");
  });

  it("compact display name is 'Plain (Classic)'; unknown names pass through untouched", () => {
    expect(phaseDisplayName("Accumulation")).toBe("Build Phase (Accumulation)");
    expect(phaseDisplayName("New Phase")).toBe("New Phase");
    expect(phaseDisplayName("Deload Week")).toBe("Deload Week");
  });
});
