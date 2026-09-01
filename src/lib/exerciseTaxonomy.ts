/* ═══════════════════════════════════════════════════════════════
   Phase 65A — exercise movement-pattern classification from the 52B
   muscle taxonomy (exercise_library.primary_muscle/secondary_muscle).
   Powers the wizard's pattern checking (the "Barbell Row on a Push
   day" class of bug) and the Change-exercise → Similar suggestions.
   Pure + DB-free: rows come in from useExerciseTaxonomy (one
   public-read query against exercise_library).
   ═══════════════════════════════════════════════════════════════ */

/** Row shape consumed from the exercise_library public-read query. */
export interface TaxonomyExercise {
  id: string;
  name: string;
  primary_muscle: string | null;
  secondary_muscle: string | null;
  equipment: string | null;
  exercise_type: string | null;
}

export type MusclePattern = 'push' | 'pull' | 'legs' | 'core' | 'any';

export const PATTERN_LABEL: Record<MusclePattern, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  any: 'Any',
};

/* Live 52B muscle vocabulary (verified against the seeded
   exercise_library_muscles data — 29 names). Anything unmapped
   classifies as 'any': never guess a pattern we have no basis for. */
const MUSCLE_PATTERN: Record<string, MusclePattern> = {
  chest: 'push', 'upper chest': 'push', shoulders: 'push', triceps: 'push', serratus: 'push',
  back: 'pull', 'upper back': 'pull', traps: 'pull', 'rear delts': 'pull', biceps: 'pull', forearms: 'pull', grip: 'pull', 'rotator cuff': 'pull',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', shins: 'legs', 'posterior chain': 'legs',
  abs: 'core', core: 'core', obliques: 'core', 'lower back': 'core', 'spinal flexibility': 'core',
  cardio: 'any', 'full body': 'any', power: 'any', 'shoulder mobility': 'any', na: 'any',
};

export function patternForMuscle(muscle: string | null | undefined): MusclePattern {
  if (!muscle) return 'any';
  return MUSCLE_PATTERN[muscle.trim().toLowerCase()] ?? 'any';
}

/** Primary muscle wins; the secondary only breaks an 'any' primary. */
export function patternForExercise(primary: string | null, secondary?: string | null): MusclePattern {
  const p = patternForMuscle(primary);
  return p !== 'any' ? p : patternForMuscle(secondary);
}

/* ── Day label → required patterns ─────────────────────── */

/** Which movement patterns a wizard day label asks for. Extends the
 *  muscleTagsFor keyword vocabulary; unknown labels (e.g. 'Workout A')
 *  allow everything — we only flag when the label gives a basis. */
export function dayPatternsForLabel(label: string): Set<'push' | 'pull' | 'legs'> {
  const w = label.toLowerCase();
  if (w.includes('upper')) return new Set(['push', 'pull']);
  if (w.includes('lower') || w.includes('legs') || w.includes('squat') || w.includes('quad')) return new Set(['legs']);
  if (w.includes('hinge') || w.includes('deadlift') || w.includes('ham')) return new Set(['legs']);
  if (w.includes('full')) return new Set(['push', 'pull', 'legs']);
  if (w.includes('arm')) return new Set(['push', 'pull']); // biceps + triceps
  if (w.includes('push') || w.includes('chest') || w.includes('shoulder')) return new Set(['push']);
  if (w.includes('pull') || w.includes('back')) return new Set(['pull']);
  return new Set(['push', 'pull', 'legs']);
}

/** Core/bracing and unclassifiable ('any') work fits every day. */
export function isPatternCompatible(dayLabel: string, pattern: MusclePattern): boolean {
  if (pattern === 'core' || pattern === 'any') return true;
  return dayPatternsForLabel(dayLabel).has(pattern);
}

/* ── Name normalization + library index ────────────────── */

/* 52A canonical normalization (ported from scripts/enrich-exercise-library.mjs):
   bridges legacy wizard names ('Back Squat') to library names ('BB Back Squat'). */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/barbell/g, 'bb')
    .replace(/dumbbell/g, 'db')
    .replace(/kettlebell/g, 'kb')
    .replace(/bodyweight/g, 'bw')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Two-level index, mirroring the 52A match strategy:
 *  1. exact normalized name ('bb back squat')
 *  2. equipment-token-stripped fallback ('back squat') — only when the
 *     stripped form is unambiguous across the whole library (null = ambiguous,
 *     never guess). Duplicate library names (a known pre-existing condition,
 *     see docs/exercise-dedup-report.md) keep the first row. */
export interface TaxonomyIndex {
  exact: Map<string, TaxonomyExercise>;
  stripped: Map<string, TaxonomyExercise | null>;
}

const EQUIPMENT_NAME_TOKENS = new Set([
  'bb', 'db', 'kb', 'bw', 'barbell', 'dumbbell', 'kettlebell', 'bodyweight',
  'machine', 'cable', 'band', 'bands', 'smith', 'ez',
]);

function stripEquipmentTokens(normalized: string): string {
  return normalized
    .split(' ')
    .filter((t) => !EQUIPMENT_NAME_TOKENS.has(t))
    .join(' ');
}

export function buildTaxonomyIndex(rows: TaxonomyExercise[]): TaxonomyIndex {
  const exact = new Map<string, TaxonomyExercise>();
  const stripped = new Map<string, TaxonomyExercise | null>();
  for (const row of rows) {
    const key = normalizeExerciseName(row.name);
    if (!exact.has(key)) exact.set(key, row);
    const sKey = stripEquipmentTokens(key);
    if (!sKey || sKey === key) continue;
    if (!stripped.has(sKey)) stripped.set(sKey, row);
    else if (stripped.get(sKey)?.id !== row.id) stripped.set(sKey, null); // ambiguous
  }
  return { exact, stripped };
}

export function findTaxonomyMatch(name: string, index: TaxonomyIndex): TaxonomyExercise | null {
  const key = normalizeExerciseName(name);
  const direct = index.exact.get(key);
  if (direct) return direct;
  return index.stripped.get(stripEquipmentTokens(key)) ?? null;
}

/* ── Similar-exercise ranking ──────────────────────────── */

export interface SimilarCandidate {
  row: TaxonomyExercise;
  score: number;
  reason: string;
  /** false when the current name isn't in the library — the list is then
   *  the honest day-pattern fallback, not a fake similarity ranking. */
  matched: boolean;
}

function equipmentTokens(equipment: string | null): string[] {
  return (equipment ?? '')
    .split('/')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Rank library rows by similarity to the current exercise:
 * same primary muscle (+40) > same movement pattern (+25) > shared
 * equipment token (+15) > same exercise type (+5). A bare equipment/type
 * match never qualifies on its own. Names already used in the program
 * week (excludedNames) and the current exercise itself are filtered out.
 *
 * fallbackDayLabel changes the shape in two honest cases, both returning
 * matched=false (a "fits this day" list, never a fake similarity ranking):
 *  - the current name isn't in the library at all, or
 *  - it IS, but its pattern doesn't fit the day (the flagged-chip case —
 *    "similar to a Barbell Row" is exactly what a Push day does NOT need).
 */
export function similarExercises(
  currentName: string,
  rows: TaxonomyExercise[],
  opts: { excludedNames?: string[]; fallbackDayLabel?: string; limit?: number } = {},
): SimilarCandidate[] {
  const limit = opts.limit ?? 8;
  const index = buildTaxonomyIndex(rows);
  const current = findTaxonomyMatch(currentName, index);
  const excluded = new Set((opts.excludedNames ?? []).map(normalizeExerciseName));
  excluded.add(normalizeExerciseName(currentName));
  const dayLabel = opts.fallbackDayLabel;

  const currentFitsDay =
    current && dayLabel
      ? isPatternCompatible(dayLabel, patternForExercise(current.primary_muscle, current.secondary_muscle))
      : true;

  if (!current || !currentFitsDay) {
    return rows
      .filter((r) => !excluded.has(normalizeExerciseName(r.name)))
      .filter((r) =>
        dayLabel ? isPatternCompatible(dayLabel, patternForExercise(r.primary_muscle, r.secondary_muscle)) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((row) => ({
        row,
        score: 0,
        matched: false,
        reason: `${PATTERN_LABEL[patternForExercise(row.primary_muscle, row.secondary_muscle)]} — fits this day`,
      }));
  }

  const currentPattern = patternForExercise(current.primary_muscle, current.secondary_muscle);
  const currentEquip = equipmentTokens(current.equipment);
  const out: SimilarCandidate[] = [];
  for (const row of rows) {
    if (excluded.has(normalizeExerciseName(row.name))) continue;
    let score = 0;
    const reasons: string[] = [];
    if (row.primary_muscle && row.primary_muscle === current.primary_muscle) {
      score += 40;
      reasons.push(`Same primary muscle (${row.primary_muscle})`);
    }
    const rowPattern = patternForExercise(row.primary_muscle, row.secondary_muscle);
    if (currentPattern !== 'any' && rowPattern === currentPattern) {
      score += 25;
      reasons.push(`${PATTERN_LABEL[rowPattern]} pattern`);
    }
    const sharedEquip = equipmentTokens(row.equipment).some((t) => currentEquip.includes(t));
    if (sharedEquip && row.equipment) {
      score += 15;
      reasons.push(row.equipment);
    }
    if (row.exercise_type && row.exercise_type === current.exercise_type) {
      score += 5;
      reasons.push(row.exercise_type);
    }
    if (score < 25) continue;
    out.push({ row, score, reason: reasons.join(' · '), matched: true });
  }
  return out.sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name)).slice(0, limit);
}
