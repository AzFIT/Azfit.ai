/* ═══════════════════════════════════════════════════════════════
   Phase 93 — exercise matcher (pure, NO new dependency).

   Normalized token similarity + prefix bonus against the exercise
   library. Score bands (named constants, unit-tested):
     ≥ AUTO_MATCH_THRESHOLD (0.8)  → auto-match
     ≥ SUGGEST_THRESHOLD  (0.5)    → "did you mean?" (one tap to accept)
     < SUGGEST_THRESHOLD           → unmatched (top-3 picker + add-to-library)
   ═══════════════════════════════════════════════════════════════ */

export interface MatchableExercise {
  id: string;
  name: string;
}

export interface ExerciseMatchResult<T extends MatchableExercise> {
  best: T | null;
  score: number;
  suggestions: T[];
}

export const AUTO_MATCH_THRESHOLD = 0.8;
export const SUGGEST_THRESHOLD = 0.5;

/** Lowercase, strip parentheticals + punctuation, collapse whitespace. */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance (small inputs — tokens). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n]!;
}

/** Similarity 0–1 of two strings by normalized Levenshtein. */
function strSim(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Token similarity tolerant of light plurals ("lunges" ≈ "lunge"). */
function tokenSim(a: string, b: string): number {
  const base = strSim(a, b);
  const aSing = a.replace(/s$/, "");
  const bSing = b.replace(/s$/, "");
  return Math.max(base, strSim(aSing, bSing), strSim(aSing, b), strSim(a, bSing));
}

/**
 * Token-set score: each query token takes its best candidate match
 * (counting matches ≥ TOKEN_MATCH_MIN toward coverage); divides by the
 * larger token count so extra words penalize, missing words too.
 */
const TOKEN_MATCH_MIN = 0.6;

function tokenScore(qTokens: string[], cTokens: string[]): number {
  if (qTokens.length === 0 || cTokens.length === 0) return 0;
  let mass = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const ct of cTokens) best = Math.max(best, tokenSim(qt, ct));
    if (best >= TOKEN_MATCH_MIN) mass += best;
  }
  return mass / Math.max(qTokens.length, cTokens.length);
}

/** Bigram Dice coefficient on the whole normalized string. */
function diceScore(a: string, b: string): number {
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return a === b ? 1 : 0;
  let overlap = 0;
  for (const [g, n] of A) overlap += Math.min(n, B.get(g) ?? 0);
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

/** Prefix bonus: same first token (+0.10), one a full prefix of the other (+0.15). */
function prefixBonus(qTokens: string[], cTokens: string[]): number {
  if (qTokens.length === 0 || cTokens.length === 0) return 0;
  if (qTokens[0] !== cTokens[0]) return 0;
  const q = qTokens.join(" ");
  const c = cTokens.join(" ");
  if (q.startsWith(c) || c.startsWith(q)) return 0.15;
  return 0.1;
}

/**
 * Full-coverage bonus: when EVERY query token found a fuzzy match in the
 * candidate (misspellings like "Hac Sqaut" vs "Machine Hack Squat"), the
 * intent is clear even if a qualifier word ("Machine") padded the candidate
 * and stole the prefix bonus. Without this, such rows fall just under
 * SUGGEST_THRESHOLD and get offered no "did you mean?".
 */
const FULL_COVERAGE_BONUS = 0.15;

function fullCoverageBonus(qTokens: string[], cTokens: string[]): number {
  if (qTokens.length === 0) return 0;
  return qTokens.every((qt) => {
    let best = 0;
    for (const ct of cTokens) best = Math.max(best, tokenSim(qt, ct));
    return best >= TOKEN_MATCH_MIN;
  })
    ? FULL_COVERAGE_BONUS
    : 0;
}

function scorePair(queryNorm: string, candNorm: string): number {
  if (!queryNorm || !candNorm) return 0;
  if (queryNorm === candNorm) return 1;
  const qTokens = queryNorm.split(" ");
  const cTokens = candNorm.split(" ");
  const t = tokenScore(qTokens, cTokens);
  const d = diceScore(queryNorm, candNorm);
  const p = prefixBonus(qTokens, cTokens);
  const f = fullCoverageBonus(qTokens, cTokens);
  return Math.min(1, 0.55 * t + 0.35 * d + p + f);
}

/**
 * Match one pasted exercise name against the library.
 * Returns the best candidate + score + top-3 suggestions (excluding best;
 * when nothing reaches the auto band, best is null and suggestions are
 * the top 3 scorers for the review picker's "did you mean" list).
 */
export function matchExercise<T extends MatchableExercise>(
  name: string,
  library: T[]
): ExerciseMatchResult<T> {
  const q = normalizeExerciseName(name);
  if (!q || library.length === 0) return { best: null, score: 0, suggestions: [] };

  const scored = library
    .map((ex) => ({ ex, score: scorePair(q, normalizeExerciseName(ex.name)) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const best = top && top.score >= AUTO_MATCH_THRESHOLD ? top.ex : null;
  const suggestions = scored
    .filter((s) => (best ? s.ex.id !== best.id : true))
    .slice(0, 3)
    .map((s) => s.ex);
  return { best, score: top?.score ?? 0, suggestions };
}
