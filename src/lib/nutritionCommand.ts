/* ═══════════════════════════════════════════════════════════════════
   Nutrition Command Center (Phase 37) — pure logic.
   Status dot: red = no targets, amber = targets but no plan,
   green = plan saved. Sort: red → amber → green, alphabetical within.
   ═══════════════════════════════════════════════════════════════════ */

export type NutritionDot = "red" | "amber" | "green";

export interface NutritionRowInput {
  name: string;
  hasTargets: boolean;
  hasPlan: boolean;
}

const DOT_RANK: Record<NutritionDot, number> = { red: 0, amber: 1, green: 2 };

export function nutritionDot(input: {
  hasTargets: boolean;
  hasPlan: boolean;
}): NutritionDot {
  if (!input.hasTargets) return "red";
  if (!input.hasPlan) return "amber";
  return "green";
}

export function sortNutritionRows<T extends NutritionRowInput>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const rankDiff = DOT_RANK[nutritionDot(a)] - DOT_RANK[nutritionDot(b)];
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}
