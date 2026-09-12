/* ═══════════════════════════════════════════════════════════════
   searchRank (Phase 90d) — pure matching for the global search
   palette. Case-insensitive substring + prefix boost on the label;
   NO external fuzzy dependency (owner rule).

   SCORING (documented):
   · exact match (label === query)        → 100
   · prefix (label starts with query)     → 80
   · word prefix (any word starts with)   → 60  ("Ben" matches "Ben Sabre")
   · substring anywhere                   → 30
   · no match                             → excluded (never fabricated)
   Ties break by shorter label, then locale compare — deterministic
   order, stable across calls.
   ═══════════════════════════════════════════════════════════════ */

export interface RankCandidate<T> {
  item: T;
  /** primary matched text (name/title) */
  label: string;
}

export interface Ranked<T> {
  item: T;
  label: string;
  score: number;
}

export function scoreLabel(label: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const l = label.toLowerCase();
  if (l === q) return 100;
  if (l.startsWith(q)) return 80;
  if (l.split(/\s+/).some((w) => w.startsWith(q))) return 60;
  if (l.includes(q)) return 30;
  return 0;
}

/** Rank candidates against a query; non-matches are excluded. */
export function rankMatches<T>(
  query: string,
  candidates: RankCandidate<T>[],
): Ranked<T>[] {
  const ranked: Ranked<T>[] = [];
  for (const c of candidates) {
    const score = scoreLabel(c.label, query);
    if (score > 0) ranked.push({ item: c.item, label: c.label, score });
  }
  return ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.label.length !== b.label.length) return a.label.length - b.label.length;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Most-visited paths from a visit-count map (localStorage-backed,
 * real user-local data). Returns up to `cap` paths ordered by visit
 * count desc, then path asc for determinism. Unknown paths in
 * `knownPaths` are the only ones suggested — visits to routes that
 * no longer exist are ignored.
 */
export function topVisited(
  visits: Record<string, number>,
  knownPaths: string[],
  cap: number,
): string[] {
  return knownPaths
    .filter((p) => (visits[p] ?? 0) > 0)
    .sort((a, b) => (visits[b] - visits[a]) || a.localeCompare(b))
    .slice(0, cap);
}
