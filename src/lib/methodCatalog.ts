/**
 * Method catalog helpers (Phase 30A — DB-backed wizard method browser).
 * Pure + unit-testable: wizard-goal → DB-goal mapping, score-based ranking,
 * category grouping, and method display-name resolution.
 *
 * NOTE: the generator (aiProgramGenerator) is goal-driven and does NOT
 * consume the selected method — in v1 the selection is program metadata
 * (name/tags/notes), not generation input.
 */

export interface DbMethod {
  id: string;
  name: string;
  slug: string;
  category: string;
  category_id: number | null;
  description: string | null;
  tags: string | null;
  display_order: number;
  /** Phase 48: Poliquin prescription defaults jsonb (16 methods; null for
   * the rest — parse via parseMethodDefaults, never render raw). */
  defaults?: unknown;
}

export interface DbMethodCategory {
  id: number;
  name: string;
  display_order: number;
}

/**
 * Wizard code-side goal id → goals-table names used for score lookups.
 * Documented mapping (the goals catalog has no Power-equivalent — power is
 * intentionally unranked; rehab maps to the two rehab-named goals).
 */
export const WIZARD_GOAL_TO_DB: Record<string, string[]> = {
  hypertrophy: ["Hypertrophy", "Build Muscle"],
  fatloss: ["Fat Loss", "Lose Weight"],
  strength: ["Strength"],
  endurance: ["Endurance", "Conditioning"],
  power: [], // no Power goal in the goals catalog — methods sort unranked
  rehab: ["Injury Rehab", "Prehab / Rehab"],
};

export interface RankedMethod extends DbMethod {
  /** Best goal_method_scores score across the mapped goals; null when none. */
  score: number | null;
}

/**
 * Rank methods by best score across the mapped goal's score rows.
 * Scored methods sort desc by score; unscored sort after, alphabetically.
 */
export function rankMethods(
  methods: DbMethod[],
  scores: Array<{ method_id: string; score: number }>
): RankedMethod[] {
  const best = new Map<string, number>();
  for (const s of scores) {
    best.set(s.method_id, Math.max(best.get(s.method_id) ?? -Infinity, s.score));
  }
  return methods
    .map((m) => ({ ...m, score: best.has(m.id) ? (best.get(m.id) as number) : null }))
    .sort((a, b) => {
      if (a.score == null && b.score == null) return a.name.localeCompare(b.name);
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score || a.name.localeCompare(b.name);
    });
}

export interface MethodGroup {
  category: string;
  methods: RankedMethod[];
}

/** Group ranked methods under their method_category, ordered by display_order. */
export function groupByCategory(
  ranked: RankedMethod[],
  categories: DbMethodCategory[]
): MethodGroup[] {
  const ordered = [...categories].sort((a, b) => a.display_order - b.display_order);
  const byId = new Map(ordered.map((c) => [c.id, c.name]));
  const groups: MethodGroup[] = [];
  const index = new Map<string, MethodGroup>();
  for (const c of ordered) {
    const g: MethodGroup = { category: c.name, methods: [] };
    groups.push(g);
    index.set(c.name, g);
  }
  const other: MethodGroup = { category: "Other", methods: [] };
  for (const m of ranked) {
    const name = m.category_id != null ? byId.get(m.category_id) : undefined;
    (name ? (index.get(name) as MethodGroup) : other).methods.push(m);
  }
  const nonEmpty = groups.filter((g) => g.methods.length > 0);
  if (other.methods.length > 0) nonEmpty.push(other);
  return nonEmpty;
}

/** Legacy wizard method ids → display labels (pre-30A saved values + METHOD_MAP defaults). */
export const LEGACY_METHOD_LABELS: Record<string, string> = {
  "german-volume": "German Volume Training",
  "5x5": "5x5 Stronglifts",
  hiit: "HIIT Metabolic",
  conjugate: "Conjugate Method",
  triphasic: "Triphasic Training",
};

/**
 * Resolve a ProgramData.method value to a display name: DB slug → live name,
 * legacy id → legacy label, otherwise the raw value humanized.
 */
export function resolveMethodName(method: string, dbMethods: DbMethod[]): string {
  if (!method) return "—";
  const db = dbMethods.find((m) => m.slug === method);
  if (db) return db.name;
  if (LEGACY_METHOD_LABELS[method]) return LEGACY_METHOD_LABELS[method];
  return method
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
