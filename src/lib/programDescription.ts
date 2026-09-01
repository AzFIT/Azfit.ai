/* ═══════════════════════════════════════════════════════════════
   Phase 66 Item 2c — Auto-fill program description built ONLY from
   the wizard's actual selections (goals, method, phases, days/week,
   duration) plus the selected client's real row data when present.
   Never references data the client doesn't have.
   ═══════════════════════════════════════════════════════════════ */

import { phaseDisplayName } from "./phaseGuidance";

export interface AutoDescriptionInput {
  /** Display names of the selected goals (primary first). */
  goalNames: string[];
  /** Resolved method display name, null when none selected. */
  methodName: string | null;
  /** Active phases (stored names + weeks). */
  phases: { name: string; weeks: number; active: boolean }[];
  daysPerWeek: number;
  totalWeeks: number;
  /** Selected client's name — omit the client sentence when null. */
  clientName?: string | null;
  /** Selected client's experience label (from their row/intake) — only
   *  referenced when non-empty. */
  clientExperience?: string | null;
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function buildAutoDescription(input: AutoDescriptionInput): string {
  const active = input.phases.filter((p) => p.active);
  const goalText = input.goalNames.length > 0 ? joinAnd(input.goalNames) : "General fitness";
  const methodText = input.methodName ? ` built around ${input.methodName}` : "";
  const s1 = `A ${goalText.toLowerCase()} program${methodText}, running ${input.daysPerWeek} day${input.daysPerWeek === 1 ? "" : "s"} per week over ${input.totalWeeks} week${input.totalWeeks === 1 ? "" : "s"}.`;

  const phaseList = active.map((p) => `${phaseDisplayName(p.name)} (${p.weeks}w)`);
  const s2 =
    phaseList.length > 0
      ? `Structured as ${active.length} phase${active.length === 1 ? "" : "s"}: ${joinAnd(phaseList)}.`
      : "Structured as a single open training block.";

  let s3 = "";
  if (input.clientName) {
    const exp = input.clientExperience?.trim();
    s3 = exp
      ? `Written for ${input.clientName}, whose ${exp} training background shapes the exercise selection and progression pace.`
      : `Written for ${input.clientName}, with the exercise selection and progression pace set to their profile.`;
  }
  return [s1, s2, s3].filter(Boolean).join(" ");
}
