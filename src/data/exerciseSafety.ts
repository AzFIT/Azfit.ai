/**
 * Exercise safety data (Phase 28D) — contraindication map.
 * Keyword lists + notes seeded verbatim from
 * KIMICODE_PHASE5_WIZARD_SAFETY.md Feature 1 (8 rows).
 */

export interface Contraindication {
  limitation: string; // doc vocabulary, e.g. 'Lower back pain'
  keywords: string[]; // lowercase substrings matched against exercise names
  severity: "exclude" | "warn";
  note: string; // trainer-facing explanation
  preferredEquipment?: string[]; // hints passed to swap scoring
}

export const EXERCISE_CONTRAINDICATIONS: Contraindication[] = [
  {
    limitation: "Lower back pain",
    keywords: ["deadlift", "good morning", "bent over row", "back squat", "overhead press"],
    severity: "exclude",
    note: "Axial loading / spinal shear",
    preferredEquipment: ["machine", "cable"],
  },
  {
    limitation: "Knee pain",
    keywords: ["squat", "lunge", "leg extension", "jump"],
    severity: "warn",
    note: "High knee stress / shear",
    preferredEquipment: ["machine"],
  },
  {
    limitation: "Shoulder pain",
    keywords: ["overhead press", "upright row", "dip", "bench press (flat)"],
    severity: "warn",
    note: "Overhead impingement risk",
  },
  {
    limitation: "Wrist pain",
    keywords: ["push-up", "plank", "front squat", "curl (barbell)"],
    severity: "warn",
    note: "Wrist extension load",
  },
  {
    limitation: "Neck pain",
    keywords: ["shrug", "overhead", "neck"],
    severity: "warn",
    note: "Cervical compression",
  },
  {
    limitation: "Hip pain",
    keywords: ["sumo", "hip thrust", "lunge"],
    severity: "warn",
    note: "Deep hip flexion",
  },
  {
    limitation: "Cardiovascular condition",
    keywords: ["hiit", "sprint", "burpee", "sled"],
    severity: "exclude",
    note: "Avoid maximal-effort conditioning",
  },
  {
    limitation: "Pregnancy",
    keywords: ["supine (after trimester 1)", "jump", "heavy valsalva"],
    severity: "warn",
    note: "Trimester-dependent — trainer review required",
  },
];

/** Wizard LIMITATIONS strings → doc vocabulary (explicit, no fuzzy match). */
export const LIMITATION_ALIASES: Record<string, string[]> = {
  "Lower back issues": ["Lower back pain"],
  "Shoulder injury": ["Shoulder pain"],
  "Knee/Hip limitations": ["Knee pain", "Hip pain"],
  "Wrist/Elbow pain": ["Wrist pain"],
  "Neck/Upper back": ["Neck pain"],
  "Cardiovascular condition": ["Cardiovascular condition"],
  Pregnancy: ["Pregnancy"],
};

/**
 * Contraindications that hit an exercise name for a given limitation set
 * (doc vocabulary — normalize wizard strings via LIMITATION_ALIASES or
 * programSafety's normalizeLimitation first).
 */
export function findContraindications(
  exerciseName: string,
  limitations: string[],
): Contraindication[] {
  const name = exerciseName.toLowerCase();
  const hits: Contraindication[] = [];
  for (const c of EXERCISE_CONTRAINDICATIONS) {
    if (!limitations.includes(c.limitation)) continue;
    if (c.keywords.some((k) => name.includes(k))) hits.push(c);
  }
  return hits;
}

/** Generic per-exercise form note for known risky movements. */
const EXERCISE_NOTES: Array<[RegExp, string]> = [
  [/deadlift/i, "Brace hard, neutral spine, bar close"],
  [/squat/i, "Knees track over toes, control the descent"],
  [/overhead press|military press/i, "Avoid excessive lumbar arch"],
  [/good morning/i, "Hinge from the hips, soft knees"],
  [/bent over row/i, "Flat back, pull to the hip"],
];

export function safetyNoteFor(exerciseName: string): string | null {
  for (const [re, note] of EXERCISE_NOTES) {
    if (re.test(exerciseName)) return note;
  }
  return null;
}
