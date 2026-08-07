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

/* ═══════════════════════════════════════════════════════════════
   Phase 56 — multi-goal scoring + Step 2 metadata filters
   ═══════════════════════════════════════════════════════════════ */

/** A DB-backed custom goal row surfaced as a Step 1 tile. */
export interface DbGoal {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

/** Tile ids for custom goals are namespaced so they never collide with the
 * six hardcoded wizard goal ids. */
export const CUSTOM_GOAL_PREFIX = "db:";
export const customGoalId = (slug: string) => `${CUSTOM_GOAL_PREFIX}${slug}`;
export const isCustomGoalId = (id: string) => id.startsWith(CUSTOM_GOAL_PREFIX);

/** DB goal names already represented by the six hardcoded Step 1 tiles. */
export const COVERED_DB_GOAL_NAMES: ReadonlySet<string> = new Set(Object.values(WIZARD_GOAL_TO_DB).flat());

/** Custom Step 1 tiles: active DB goals NOT already covered by a hardcoded
 * tile (archived goals hide; covered names would duplicate the fixed tiles). */
export function customGoalTiles(goals: DbGoal[]): DbGoal[] {
  return goals.filter((g) => g.is_active && !COVERED_DB_GOAL_NAMES.has(g.name));
}

/**
 * Score-lookup goal NAMES for a set of selected tile ids: hardcoded tiles map
 * via WIZARD_GOAL_TO_DB; custom tiles contribute their own DB name. Union,
 * deduped. rankMethods already takes the max score per method across all
 * rows — that is the documented multi-goal aggregation.
 */
export function dbNamesForGoalSelection(selectedIds: string[], customGoals: DbGoal[]): string[] {
  const names = new Set<string>();
  for (const id of selectedIds) {
    if (isCustomGoalId(id)) {
      const slug = id.slice(CUSTOM_GOAL_PREFIX.length);
      const g = customGoals.find((c) => c.slug === slug);
      if (g) names.add(g.name);
    } else {
      for (const n of WIZARD_GOAL_TO_DB[id] ?? []) names.add(n);
    }
  }
  return [...names];
}

/** Hashtag set of a method's tags text ("#a #b" → {"a","b"}), lowercase. */
export function methodTagSet(tags: string | null | undefined): Set<string> {
  if (!tags) return new Set();
  return new Set(
    tags
      .split(/\s+/)
      .map((t) => t.replace(/^#/, "").trim().toLowerCase())
      .filter(Boolean),
  );
}

/* Step 2 metadata filters (Phase 56, Item 2). Verified live vocabulary:
   experience tags exist (#beginner-friendly #intermediate #advanced
   #all-levels); #elite and ALL equipment tags are absent from the catalog
   today — chips still work, equipment simply never narrows until such
   metadata exists (positive-match-only semantics below). */
export const EXPERIENCE_FILTERS: Record<string, string> = {
  Beginner: "beginner-friendly",
  Intermediate: "intermediate",
  Advanced: "advanced",
  Elite: "elite",
};
export const EQUIPMENT_FILTERS: Record<string, string> = {
  "Full Gym": "full-gym",
  Dumbbells: "dumbbells",
  Bodyweight: "bodyweight",
  Minimal: "minimal",
};

/**
 * Positive-match-only filtering per dimension: a method WITHOUT metadata for
 * that dimension always stays visible; a method WITH such tags must match at
 * least one selected chip. #all-levels satisfies any experience selection.
 * No chips selected → no filtering for that dimension.
 */
export function matchesMetadataFilters(
  tags: string | null | undefined,
  experienceSel: string[],
  equipmentSel: string[],
): boolean {
  const set = methodTagSet(tags);
  if (experienceSel.length) {
    const expTags = [...Object.values(EXPERIENCE_FILTERS), "all-levels"];
    const hasExpMeta = expTags.some((t) => set.has(t));
    const expPass =
      set.has("all-levels") || experienceSel.some((chip) => set.has(EXPERIENCE_FILTERS[chip]));
    if (hasExpMeta && !expPass) return false;
  }
  if (equipmentSel.length) {
    const eqTags = Object.values(EQUIPMENT_FILTERS);
    const hasEqMeta = eqTags.some((t) => set.has(t));
    const eqPass = equipmentSel.some((chip) => set.has(EQUIPMENT_FILTERS[chip]));
    if (hasEqMeta && !eqPass) return false;
  }
  return true;
}
