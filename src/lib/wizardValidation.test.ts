import { describe, it, expect } from "vitest";
import { issueForStep, FIELD_BY_STEP, type WizardCompleteness } from "./wizardValidation";

const complete: WizardCompleteness = {
  goals: ["hypertrophy"],
  method: "gvt",
  clientExperience: "1-3 years",
  hasActivePhase: true,
  hasActiveDay: true,
  exerciseCount: 6,
  programName: "My Program",
};

describe("issueForStep (Phase 66 Item 2g) — first missing field per step", () => {
  it("returns null for every step when the wizard is complete", () => {
    for (let s = 0; s <= 7; s++) expect(issueForStep(s, complete)).toBeNull();
  });

  it("names the exact missing thing per step", () => {
    expect(issueForStep(0, { ...complete, goals: [] })).toEqual({ field: "goals", message: "Select at least one goal to continue." });
    expect(issueForStep(1, { ...complete, method: "" })?.field).toBe("method");
    expect(issueForStep(2, { ...complete, clientExperience: "" })?.field).toBe("experience");
    expect(issueForStep(3, { ...complete, hasActivePhase: false })?.field).toBe("phases");
    expect(issueForStep(4, { ...complete, hasActiveDay: false })?.field).toBe("split");
    expect(issueForStep(5, { ...complete, exerciseCount: 0 })?.field).toBe("exercises");
    expect(issueForStep(7, { ...complete, programName: "  " })).toEqual({ field: "programName", message: "Name your program to save." });
  });

  it("preview (step 6) compounds goal + method checks", () => {
    expect(issueForStep(6, { ...complete, goals: [] })?.field).toBe("goals");
    expect(issueForStep(6, { ...complete, method: "" })?.field).toBe("method");
    expect(issueForStep(6, complete)).toBeNull();
  });

  it("every step has a data-field anchor", () => {
    expect(FIELD_BY_STEP).toHaveLength(8);
    expect(new Set(FIELD_BY_STEP).size).toBe(8);
  });
});
