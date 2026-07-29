/**
 * Progression rules (Phase 30D, doc item 7) — pure + unit-testable.
 * Presets + the week-note logic used by the week-by-week preview.
 */

export interface ProgressionRule {
  /** Preset id when the rule came from a preset; absent for custom rules. */
  id?: string;
  label: string;
  text: string;
}

export const PROGRESSION_PRESETS: ProgressionRule[] = [
  { id: "double", label: "Double Progression", text: "Add +2.5kg when the top of the rep range is hit on all sets" },
  { id: "linear", label: "Linear Weekly Load", text: "Add +2.5kg (upper) / +5kg (lower) each week" },
  { id: "deload", label: "Deload Every 4th Week", text: "Week 4: −40% volume, same loads" },
  { id: "rest-pause", label: "Reduce Rest Periods", text: "Reduce rest by 15s when all sets completed" },
  { id: "none", label: "No Progression (repeat weekly)", text: "Repeat the same plan each week" },
];

export const DELOAD_WEEK_INTERVAL = 4;

/**
 * Progression note applicable to a given week (1-based), per active rules:
 * deload weeks (every 4th) show the deload rule's text; other weeks show the
 * first load-progression rule's text (double/linear/rest-pause/custom), or
 * null when nothing applies.
 */
export function progressionNoteForWeek(
  week: number,
  rules: ProgressionRule[]
): string | null {
  if (rules.length === 0 || week < 1) return null;
  const deload = rules.find((r) => r.id === "deload");
  if (deload && week % DELOAD_WEEK_INTERVAL === 0) return deload.text;
  const loadRule = rules.find((r) => r.id !== "deload" && r.id !== "none");
  if (loadRule) return loadRule.text;
  const noneRule = rules.find((r) => r.id === "none");
  return noneRule ? noneRule.text : null;
}
