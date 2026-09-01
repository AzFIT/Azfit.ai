/* ═══════════════════════════════════════════════════════════════
   Phase 66 Item 2g — first-missing-field detection per wizard step.
   Feeds the validation jump: blocked Next/Save scrolls to the step
   region and shows this message (top and bottom nav bars share it via
   the 65B WizardNavBar). Step indexes match the STEPS array.
   ═══════════════════════════════════════════════════════════════ */

export interface WizardIssue {
  /** data-field anchor on the step region (scroll + highlight target). */
  field: string;
  /** Short inline message naming what's missing. */
  message: string;
}

export interface WizardCompleteness {
  goals: string[];
  method: string;
  clientExperience: string;
  hasActivePhase: boolean;
  hasActiveDay: boolean;
  exerciseCount: number;
  programName: string;
}

/** data-field anchors per step index (rendered on the step wrapper). */
export const FIELD_BY_STEP = [
  "goals",
  "method",
  "experience",
  "phases",
  "split",
  "exercises",
  "preview",
  "programName",
] as const;

export function issueForStep(step: number, c: WizardCompleteness): WizardIssue | null {
  switch (step) {
    case 0:
      return c.goals.length === 0
        ? { field: "goals", message: "Select at least one goal to continue." }
        : null;
    case 1:
      return !c.method
        ? { field: "method", message: "Pick a training method to continue." }
        : null;
    case 2:
      return !c.clientExperience
        ? { field: "experience", message: "Choose the client's experience level to continue." }
        : null;
    case 3:
      return !c.hasActivePhase
        ? { field: "phases", message: "Activate at least one phase to continue." }
        : null;
    case 4:
      return !c.hasActiveDay
        ? { field: "split", message: "Activate at least one training day to continue." }
        : null;
    case 5:
      return c.exerciseCount === 0
        ? { field: "exercises", message: "Add at least one exercise to continue." }
        : null;
    case 6:
      if (c.goals.length === 0) return { field: "goals", message: "Select at least one goal before reviewing." };
      if (!c.method) return { field: "method", message: "Pick a training method before reviewing." };
      return null;
    case 7:
      return !c.programName.trim()
        ? { field: "programName", message: "Name your program to save." }
        : null;
    default:
      return null;
  }
}
