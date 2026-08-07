import { describe, it, expect } from "vitest";
import {
  wizardGoalToClientGoal,
  intakeTargetsEligible,
  profileGaps,
  profileGapReason,
  summarizeVerdicts,
  WIZARD_GOALS,
} from "./trialIntake";

describe("wizardGoalToClientGoal", () => {
  it("maps direct enum values", () => {
    expect(wizardGoalToClientGoal("lose_weight")).toEqual({ goal_type: "lose_weight", custom_label: null });
    expect(wizardGoalToClientGoal("build_muscle")).toEqual({ goal_type: "build_muscle", custom_label: null });
    expect(wizardGoalToClientGoal("strength")).toEqual({ goal_type: "increase_strength", custom_label: null });
  });

  it("maps endurance + general_fitness to improve_fitness", () => {
    expect(wizardGoalToClientGoal("endurance").goal_type).toBe("improve_fitness");
    expect(wizardGoalToClientGoal("general_fitness").goal_type).toBe("improve_fitness");
  });

  it("maps unmatched goals to custom with the label preserved", () => {
    expect(wizardGoalToClientGoal("athletic_performance")).toEqual({ goal_type: "custom", custom_label: "Athletic Performance" });
    expect(wizardGoalToClientGoal("rehab_mobility")).toEqual({ goal_type: "custom", custom_label: "Rehab & Mobility" });
  });

  it("every wizard goal chip has a valid mapping", () => {
    for (const g of WIZARD_GOALS) {
      const m = wizardGoalToClientGoal(g.value);
      expect(m.goal_type).toBeTruthy();
      if (m.goal_type === "custom") expect(m.custom_label).toBeTruthy();
    }
  });
});

describe("intakeTargetsEligible (skip-body guard)", () => {
  it("requires weight + height + dob", () => {
    expect(intakeTargetsEligible({ weightKg: 80, heightCm: 180, dob: "1996-01-01" })).toBe(true);
  });
  it("skipped body step → not eligible (no targets fabricated)", () => {
    expect(intakeTargetsEligible({ weightKg: 0, heightCm: 0, dob: "" })).toBe(false);
  });
  it("partial body data → not eligible", () => {
    expect(intakeTargetsEligible({ weightKg: 80, heightCm: 0, dob: "1996-01-01" })).toBe(false);
    expect(intakeTargetsEligible({ weightKg: 80, heightCm: 180, dob: "" })).toBe(false);
  });
});

describe("profileGaps + profileGapReason", () => {
  const full = { weight_kg: 80, height_cm: 180, date_of_birth: "1996-01-01", fitness_goal: "build_muscle" };
  it("complete profile → no gaps", () => {
    expect(profileGaps(full)).toEqual([]);
  });
  it("trial client (name only) → all gaps", () => {
    expect(profileGaps({ weight_kg: null, height_cm: null, date_of_birth: null, fitness_goal: null })).toEqual([
      "weight",
      "height",
      "date of birth",
      "goal",
    ]);
  });
  it("goal-only gap", () => {
    expect(profileGaps({ ...full, fitness_goal: null })).toEqual(["goal"]);
  });
  it("reason lines", () => {
    expect(profileGapReason(["weight", "height"])).toBe("Missing body metrics (weight, height)");
    expect(profileGapReason(["goal"])).toBe("No goal set");
    expect(profileGapReason(["date of birth", "goal"])).toBe("Missing body metrics (date of birth) · No goal set");
    expect(profileGapReason([])).toBe("");
  });
});

describe("summarizeVerdicts", () => {
  it("counts each verdict + unset", () => {
    const s = summarizeVerdicts([
      { verdict: "can_do" },
      { verdict: "can_do" },
      { verdict: "needs_modification" },
      { verdict: "cannot_do" },
      { verdict: null },
    ]);
    expect(s).toEqual({ can_do: 2, needs_modification: 1, cannot_do: 1, unset: 1, total: 5 });
  });
  it("empty list → all zeros", () => {
    expect(summarizeVerdicts([])).toEqual({ can_do: 0, needs_modification: 0, cannot_do: 0, unset: 0, total: 0 });
  });
});
