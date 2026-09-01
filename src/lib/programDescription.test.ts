import { describe, it, expect } from "vitest";
import { buildAutoDescription } from "./programDescription";

const base = {
  goalNames: ["Hypertrophy"],
  methodName: "German Volume Training (10×10)",
  phases: [
    { name: "Accumulation", weeks: 4, active: true },
    { name: "Intensification", weeks: 4, active: true },
    { name: "Realization", weeks: 4, active: false },
  ],
  daysPerWeek: 4,
  totalWeeks: 8,
};

describe("buildAutoDescription (Phase 66 Item 2c) — only real selections", () => {
  it("covers goals, method, days/week, duration and active phases only", () => {
    const d = buildAutoDescription(base);
    expect(d).toContain("hypertrophy");
    expect(d).toContain("German Volume Training (10×10)");
    expect(d).toContain("4 days per week");
    expect(d).toContain("8 weeks");
    expect(d).toContain("Build Phase (Accumulation) (4w)");
    expect(d).toContain("Push Phase (Intensification) (4w)");
    expect(d).not.toContain("Realization"); // inactive phase never referenced
    expect(d).not.toContain("Written for"); // no client selected
  });

  it("adds an honest client sentence when name + experience exist", () => {
    const d = buildAutoDescription({ ...base, clientName: "Alex Carter", clientExperience: "intermediate" });
    expect(d).toContain("Written for Alex Carter");
    expect(d).toContain("intermediate");
  });

  it("client name without experience gets a profile-free sentence; no fabrication", () => {
    const d = buildAutoDescription({ ...base, clientName: "Amy Gregg", clientExperience: "" });
    expect(d).toContain("Written for Amy Gregg");
    expect(d).not.toContain("training background");
  });

  it("degenerates honestly: no goals, no method, no active phases", () => {
    const d = buildAutoDescription({
      goalNames: [],
      methodName: null,
      phases: [{ name: "Accumulation", weeks: 4, active: false }],
      daysPerWeek: 1,
      totalWeeks: 1,
    });
    expect(d).toContain("general fitness");
    expect(d).toContain("1 day per week");
    expect(d).toContain("1 week");
    expect(d).toContain("single open training block");
    expect(d).not.toContain("undefined");
    expect(d).not.toContain("null");
  });
});
