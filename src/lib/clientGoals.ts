/**
 * Client goals (Phase 27B) — shared labels + progress math for the
 * client_goals table. Pure helpers (no side effects).
 */

import type { Database } from "@/types/supabase";

export type ClientGoalRow = Database["public"]["Tables"]["client_goals"]["Row"];
export type ClientGoalType = ClientGoalRow["goal_type"];

export const GOAL_TYPE_LABELS: Record<ClientGoalType, string> = {
  lose_weight: "Lose Weight",
  build_muscle: "Build Muscle",
  reduce_body_fat: "Reduce Body Fat",
  increase_strength: "Increase Strength",
  improve_fitness: "Improve Fitness",
  custom: "Custom",
};

export function goalLabel(goal: Pick<ClientGoalRow, "goal_type" | "custom_label">): string {
  return goal.goal_type === "custom"
    ? goal.custom_label || "Custom"
    : GOAL_TYPE_LABELS[goal.goal_type];
}

/**
 * Progress toward a numeric target as 0–100.
 * lose_weight / reduce_body_fat: distance covered ÷ total distance
 * (start → target, where target < start). Clamped; null when not computable.
 */
export function progressPercent(
  start: number | null | undefined,
  current: number | null | undefined,
  target: number | null | undefined,
): number | null {
  if (start == null || current == null || target == null) return null;
  const total = start - target;
  if (total <= 0) return current <= target ? 100 : 0; // already at/past target direction
  const done = start - current;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

/** Nearest value to a date from dated rows (by absolute distance). */
export function nearestToDate<T extends { recorded_at: string }>(
  rows: T[],
  dateStr: string,
  pick: (row: T) => number | null,
): number | null {
  const target = new Date(dateStr).getTime();
  let best: number | null = null;
  let bestDist = Infinity;
  for (const row of rows) {
    const v = pick(row);
    if (v == null) continue;
    const dist = Math.abs(new Date(row.recorded_at).getTime() - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}
