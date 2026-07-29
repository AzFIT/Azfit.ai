/**
 * Method-aware phase suggestions (Phase 30B).
 * Pure + unit-testable. Maps the selected method (30A catalog name or slug,
 * legacy id) to a suggested phase structure. Null → no suggestion (the
 * wizard keeps its current phases / PHASES_DEFAULT).
 */

export interface PhaseSuggestion {
  name: string;
  weeks: number;
  focus: string;
  color: string;
}

/**
 * Documented method → phase-structure map. Regexes are hyphen-tolerant so
 * they match DB slugs ("german-volume-training-10x10"), catalog names
 * ("German Volume Training (10x10)") and legacy ids ("german-volume").
 */
const SUGGESTIONS: Array<[RegExp, PhaseSuggestion[]]> = [
  [
    /german[ -]?volume|10x10|gbc|german[ -]?body/i,
    [
      { name: "Accumulation", weeks: 6, focus: "High-volume accumulation block at moderate intensity", color: "#F59E0B" },
    ],
  ],
  [
    /5\s?x\s?5|stronglift/i,
    [
      { name: "Foundation", weeks: 4, focus: "Groove the big lifts and build work capacity", color: "#00AEEF" },
      { name: "Intensification", weeks: 4, focus: "Ramp intensity toward new strength peaks", color: "#EF4444" },
    ],
  ],
  [
    /triphasic|conjugate/i,
    [
      { name: "Accumulation", weeks: 4, focus: "Build work capacity and aerobic base with higher volume", color: "#F59E0B" },
      { name: "Intensification", weeks: 4, focus: "Increase intensity with moderate volume reduction", color: "#EF4444" },
      { name: "Realization", weeks: 4, focus: "Peak intensity with sport-specific demands", color: "#22C55E" },
    ],
  ],
];

/** Suggested phase structure for a method name/slug, or null when none applies. */
export function suggestPhasesForMethod(methodNameOrSlug: string): PhaseSuggestion[] | null {
  if (!methodNameOrSlug) return null;
  for (const [re, phases] of SUGGESTIONS) {
    if (re.test(methodNameOrSlug)) return phases;
  }
  return null;
}
