/**
 * Program safety evaluation (Phase 28D) — pure functions.
 * Merges wizard limitations + free text + intake injuries into the
 * contraindication vocabulary, then evaluates an exercise list.
 */

import {
  findContraindications,
  LIMITATION_ALIASES,
  type Contraindication,
} from "@/data/exerciseSafety";
import {
  findExerciseSubstitutions,
  type SwapCandidate,
} from "@/lib/exerciseSwap";
import type { ClientProfile } from "@/lib/aiProgramGenerator";
import type { ProgramData, ProgramExercise } from "@/pages/AIProgramBuilder";

/** Sentinel: unmatched free text → generic 'warn' on compound exercises only. */
export const GENERIC_WARN = "__generic_warn__";

export interface SafetyFlag {
  exerciseCode: string;
  exerciseName: string;
  exerciseIndex: number; // index within the evaluated list
  limitation: string;
  severity: "exclude" | "warn";
  note: string;
  alternatives: SwapCandidate[]; // top 3 (only for 'exclude')
  resolved?: boolean;
}

/** Keyword-based normalization of free text into the doc vocabulary. */
const FREE_TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/back|spine|disc|lumbar/, "Lower back pain"],
  [/knee|acl|meniscus|patella/, "Knee pain"],
  [/shoulder|rotator/, "Shoulder pain"],
  [/wrist|elbow/, "Wrist pain"],
  [/neck|cervical|upper back/, "Neck pain"],
  [/hip/, "Hip pain"],
  [/cardio|heart|hypertension|blood pressure/, "Cardiovascular condition"],
  [/pregnan/, "Pregnancy"],
];

const VOCAB = new Set(EXERCISE_CONTRAINDICATION_NAMES());
function EXERCISE_CONTRAINDICATION_NAMES(): string[] {
  // Local to avoid a circular import at module scope
  return [
    "Lower back pain",
    "Knee pain",
    "Shoulder pain",
    "Wrist pain",
    "Neck pain",
    "Hip pain",
    "Cardiovascular condition",
    "Pregnancy",
  ];
}

/**
 * Normalize one raw limitation string (wizard chip, free text, or intake
 * injuries fragment) into doc-vocabulary limitations (+ GENERIC_WARN sentinel).
 */
export function normalizeLimitation(raw: string): string[] {
  const t = raw.trim();
  if (!t || t === "None (healthy)" || t === "Other") return [];
  if (LIMITATION_ALIASES[t]) return LIMITATION_ALIASES[t];
  const lower = t.toLowerCase();
  for (const v of VOCAB) {
    if (v.toLowerCase() === lower) return [v];
  }
  for (const [re, vocab] of FREE_TEXT_PATTERNS) {
    if (re.test(lower)) return [vocab];
  }
  return [GENERIC_WARN];
}

/**
 * Merge clientContext.limitations + otherLimitation free text + intake
 * injuries string; normalize everything into doc vocabulary.
 */
export function collectClientLimitations(
  data: Pick<ProgramData, "clientContext">,
  clientProfile: Pick<ClientProfile, "injuries"> | null,
): string[] {
  const raw: string[] = [...data.clientContext.limitations];
  if (data.clientContext.otherLimitation) raw.push(data.clientContext.otherLimitation);
  if (clientProfile?.injuries) {
    raw.push(...clientProfile.injuries.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean));
  }
  const out = new Set<string>();
  for (const item of raw) {
    for (const n of normalizeLimitation(item)) out.add(n);
  }
  return [...out];
}

const COMPOUND_RE = /squat|deadlift|press|row|lunge|pull-?up|chin-?up|hip thrust|clean|snatch|good morning/i;

function mergeHits(code: string, name: string, index: number, hits: Contraindication[], allNames: string[]): SafetyFlag {
  const exclude = hits.some((h) => h.severity === "exclude");
  const alternatives = exclude
    ? findExerciseSubstitutions(name, {
        reason: hits.map((h) => h.limitation).join(" "),
        excluded: allNames,
      }).slice(0, 3)
    : [];
  return {
    exerciseCode: code,
    exerciseName: name,
    exerciseIndex: index,
    limitation: [...new Set(hits.map((h) => h.limitation))].join(" + "),
    severity: exclude ? "exclude" : "warn",
    note: hits[0].note,
    alternatives,
    resolved: false,
  };
}

/**
 * Evaluate an exercise list against doc-vocabulary limitations.
 * 'exclude' hits pull top-3 alternatives; 'warn' does not. Unmatched free
 * text (GENERIC_WARN) only warns on compound exercises.
 */
export function evaluateProgramSafety(
  exercises: ProgramExercise[],
  limitations: string[],
): SafetyFlag[] {
  if (limitations.length === 0 || exercises.length === 0) return [];
  const genericWarn = limitations.includes(GENERIC_WARN);
  const concrete = limitations.filter((l) => l !== GENERIC_WARN);
  const allNames = exercises.map((e) => e.name);
  const flags: SafetyFlag[] = [];

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const hits = concrete.length > 0 ? findContraindications(ex.name, concrete) : [];
    if (hits.length > 0) {
      flags.push(mergeHits(ex.code, ex.name, i, hits, allNames));
    } else if (genericWarn && COMPOUND_RE.test(ex.name)) {
      flags.push({
        exerciseCode: ex.code,
        exerciseName: ex.name,
        exerciseIndex: i,
        limitation: "Unspecified limitation",
        severity: "warn",
        note: "Generic caution — unspecified client limitation; review form and loading.",
        alternatives: [],
        resolved: false,
      });
    }
  }
  return flags;
}
