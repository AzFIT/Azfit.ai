/* ═══════════════════════════════════════════════════════════════
   Phase 53 — trial intake + trial assessment pure helpers.
   ═══════════════════════════════════════════════════════════════ */

import type { Database } from "@/types/supabase";

export type ClientGoalType = Database["public"]["Tables"]["client_goals"]["Row"]["goal_type"];

/* ── Wizard goal → client_goals mapping ─────────────────────────
   The intake wizard offers 7 goal chips; client_goals.goal_type is
   a 6-value CHECK. Values without a direct enum map to `custom`
   with their label preserved in custom_label. */
export const WIZARD_GOALS = [
  { value: "lose_weight", label: "Lose Weight" },
  { value: "build_muscle", label: "Build Muscle" },
  { value: "strength", label: "Strength" },
  { value: "endurance", label: "Endurance" },
  { value: "athletic_performance", label: "Athletic Performance" },
  { value: "rehab_mobility", label: "Rehab & Mobility" },
  { value: "general_fitness", label: "General Fitness" },
] as const;

export type WizardGoalValue = (typeof WIZARD_GOALS)[number]["value"];

/** Equipment chip options — single source for wizard + edit modal. */
export const EQUIPMENT_OPTIONS = ["Full Gym", "Dumbbells Only", "Bodyweight", "Home Gym", "Commercial Gym"];

export function wizardGoalToClientGoal(value: string): { goal_type: ClientGoalType; custom_label: string | null } {
  switch (value) {
    case "lose_weight":
      return { goal_type: "lose_weight", custom_label: null };
    case "build_muscle":
      return { goal_type: "build_muscle", custom_label: null };
    case "strength":
      return { goal_type: "increase_strength", custom_label: null };
    case "endurance":
    case "general_fitness":
      return { goal_type: "improve_fitness", custom_label: null };
    case "athletic_performance":
      return { goal_type: "custom", custom_label: "Athletic Performance" };
    case "rehab_mobility":
      return { goal_type: "custom", custom_label: "Rehab & Mobility" };
    default:
      return { goal_type: "custom", custom_label: value || "Custom" };
  }
}

/* ── Skippable Body step ────────────────────────────────────────
   The 28E TDEE pipeline may only run when weight + height + DOB
   are all present; otherwise the wizard finishes with NO targets
   (honest empty Nutrition tab — no fabricated numbers). */
export function intakeTargetsEligible(input: { weightKg: number; heightCm: number; dob: string }): boolean {
  return input.weightKg > 0 && input.heightCm > 0 && input.dob.trim().length > 0;
}

/* ── "Profile incomplete" derivation ────────────────────────────
   Pure: gaps in body metrics (weight/height/DOB) or goal. */
export interface ProfileGapInput {
  weight_kg: number | null;
  height_cm: number | null;
  date_of_birth: string | null;
  fitness_goal: string | null;
}

export function profileGaps(c: ProfileGapInput): string[] {
  const gaps: string[] = [];
  if (!c.weight_kg) gaps.push("weight");
  if (!c.height_cm) gaps.push("height");
  if (!c.date_of_birth) gaps.push("date of birth");
  if (!c.fitness_goal) gaps.push("goal");
  return gaps;
}

/** Short reason line for badges/widgets, e.g. "Missing body metrics · No goal set". */
export function profileGapReason(gaps: string[]): string {
  const parts: string[] = [];
  const body = gaps.filter((g) => g !== "goal");
  if (body.length) parts.push(`Missing body metrics (${body.join(", ")})`);
  if (gaps.includes("goal")) parts.push("No goal set");
  return parts.join(" · ");
}

/* ── Trial assessment verdict aggregation ─────────────────────── */
export type TrialVerdict = "can_do" | "needs_modification" | "cannot_do";

export interface VerdictSummary {
  can_do: number;
  needs_modification: number;
  cannot_do: number;
  unset: number;
  total: number;
}

export function summarizeVerdicts(items: { verdict: string | null }[]): VerdictSummary {
  const s: VerdictSummary = { can_do: 0, needs_modification: 0, cannot_do: 0, unset: 0, total: items.length };
  for (const it of items) {
    if (it.verdict === "can_do") s.can_do++;
    else if (it.verdict === "needs_modification") s.needs_modification++;
    else if (it.verdict === "cannot_do") s.cannot_do++;
    else s.unset++;
  }
  return s;
}

export const VERDICT_META: Record<TrialVerdict, { label: string; color: string; bg: string }> = {
  can_do: { label: "Can do", color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
  needs_modification: { label: "Needs modification", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  cannot_do: { label: "Cannot do", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};
