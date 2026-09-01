/* ═══════════════════════════════════════════════════════════════
   Phase 66 Item 1 — plain-language phase guidance for the Program
   Creator. DISPLAY ONLY: stored phase names ('Accumulation', …) are
   unchanged; this maps them to a plain label + the classic term as a
   subtitle + a curated 2–3 sentence description. Unknown/custom phase
   names get no mapping (rendered as-is, never relabeled).
   ═══════════════════════════════════════════════════════════════ */

export interface PhaseGuidance {
  /** Plain-language label, e.g. 'Build Phase' */
  plain: string;
  /** The classic term, shown as a subtitle, e.g. 'Accumulation' */
  classic: string;
  /** Curated guidance copy: purpose, feel (volume vs intensity), who it suits. */
  description: string;
}

const GUIDANCE: Record<string, PhaseGuidance> = {
  accumulation: {
    plain: "Build Phase",
    classic: "Accumulation",
    description:
      "High-volume work with moderate weights — more sets and reps to grow muscle and work capacity. It feels like steady, grind-it-out training rather than max effort. Suits beginners building a base and intermediates coming back from a break.",
  },
  intensification: {
    plain: "Push Phase",
    classic: "Intensification",
    description:
      "Heavier weights with lower reps and longer rests — the volume drops while the intensity climbs. Sessions feel demanding but shorter. Suits intermediate and advanced lifters who already have a solid base.",
  },
  realization: {
    plain: "Peak Phase",
    classic: "Realization",
    description:
      "The sharpening block: low volume, high intensity, practicing heavy or explosive efforts while fatigue drops. Sessions feel short and sharp. Suits advanced lifters peaking for a test, meet, or event.",
  },
  adaptation: {
    plain: "Foundation Phase",
    classic: "Adaptation",
    description:
      "A gentle onboarding block that grooves technique and consistency with moderate volume and intensity. It should feel manageable — the goal is showing up, not setting records. Suits beginners and anyone returning to training.",
  },
};

/** Plain-label parts for a stored phase name, or null when unknown. */
export function phaseGuidanceFor(name: string): PhaseGuidance | null {
  return GUIDANCE[name.trim().toLowerCase()] ?? null;
}

/** Display label for compact contexts: 'Build Phase (Accumulation)',
 *  or the raw name when there is no mapping (custom phases). */
export function phaseDisplayName(name: string): string {
  const g = phaseGuidanceFor(name);
  return g ? `${g.plain} (${g.classic})` : name;
}
