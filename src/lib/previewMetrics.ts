/**
 * Preview metrics (Phase 30D, doc item 10) — pure + unit-testable.
 * All values are DERIVED from the program's own data; nothing is fabricated.
 */

import { EXERCISE_CATEGORIES } from "@/data/exerciseDatabase";

/** name → category-id index over the generator's category table (exact match). */
export function buildExerciseCategoryIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const cat of EXERCISE_CATEGORIES) {
    for (const name of [...cat.exercises, ...cat.alternatives]) {
      index.set(name.toLowerCase(), cat.id);
    }
  }
  return index;
}

const CATEGORY_LABELS = new Map(EXERCISE_CATEGORIES.map((c) => [c.id, c.label]));

export interface MuscleGroupSets {
  category: string;
  label: string;
  sets: number;
  pct: number;
}

/**
 * Sets per muscle-group category across the given exercises.
 * Best-effort: names matched exactly against EXERCISE_CATEGORIES
 * (exercises + alternatives); unmatched names aggregate under 'Other'.
 */
export function setsPerMuscleGroup(
  exercises: Array<{ name: string; sets: number }>
): MuscleGroupSets[] {
  const index = buildExerciseCategoryIndex();
  const totals = new Map<string, number>();
  let totalSets = 0;
  for (const ex of exercises) {
    const cat = index.get(ex.name.toLowerCase()) ?? "other";
    const sets = ex.sets || 0;
    totals.set(cat, (totals.get(cat) ?? 0) + sets);
    totalSets += sets;
  }
  return [...totals.entries()]
    .map(([cat, sets]) => ({
      category: cat,
      label: cat === "other" ? "Other" : (CATEGORY_LABELS.get(cat) ?? cat),
      sets,
      pct: totalSets > 0 ? Math.round((sets / totalSets) * 100) : 0,
    }))
    .sort((a, b) => b.sets - a.sets);
}

/**
 * Equipment inference from the exercise name (documented regexes; first
 * match wins — 'db'/'dumbbell' checked before 'bb' because 'dumbbell'
 * contains 'bb').
 */
export function inferEquipment(name: string): string {
  const n = name.toLowerCase();
  if (/dumbbell|\bdb\b/.test(n)) return "Dumbbells";
  if (/barbell|\bbb\b/.test(n)) return "Barbell";
  if (/cable/.test(n)) return "Cable";
  if (/machine|smith|leg press|hack/.test(n)) return "Machines";
  if (/pull[- ]?up|chin|push[- ]?up|plank|dip\b|bear crawl/.test(n)) return "Bodyweight/Rack";
  return "Other";
}

export interface EquipmentCheck {
  item: string;
  /** true = covered, false = missing, null = can't verify (Full Gym assumed). */
  covered: boolean | null;
}

/**
 * Coverage of the client's intake equipment (documented mapping):
 * 'Dumbbells Only' → Dumbbells + Bodyweight; 'Bodyweight Only' → Bodyweight/Rack;
 * 'Home Gym (limited)' → Barbell + Dumbbells + Bodyweight; 'Full Gym' → all.
 * 'Other' items are never verifiable (⚠️). null clientEquipment → all null.
 */
export function equipmentChecklist(
  exercises: Array<{ name: string }>,
  clientEquipment: string[] | null
): EquipmentCheck[] {
  const items = [...new Set(exercises.map((e) => inferEquipment(e.name)))].sort();
  return items.map((item) => {
    if (clientEquipment == null || item === "Other") {
      return { item, covered: clientEquipment == null ? null : false };
    }
    if (clientEquipment.includes("Full Gym")) return { item, covered: true };
    const coveredBy: Record<string, string[]> = {
      "Dumbbells Only": ["Dumbbells", "Bodyweight/Rack"],
      "Bodyweight Only": ["Bodyweight/Rack"],
      "Home Gym (limited)": ["Barbell", "Dumbbells", "Bodyweight/Rack"],
    };
    const covered = Object.entries(coveredBy).some(
      ([key, list]) => clientEquipment.includes(key) && list.includes(item)
    );
    return { item, covered };
  });
}

/**
 * Estimated session time (documented formula): each set takes ~40s under
 * tension + transition, plus the rest periods (rest strings "m:ss").
 * Returns whole minutes, rounded.
 */
export function estimateSessionMinutes(
  exercises: Array<{ sets: number; rest: string }>
): number {
  let seconds = 0;
  for (const ex of exercises) {
    seconds += (ex.sets || 0) * 40;
    const [mm, ss] = (ex.rest || "0:00").split(":").map((x) => parseInt(x) || 0);
    seconds += mm * 60 + ss;
  }
  return Math.round(seconds / 60);
}
