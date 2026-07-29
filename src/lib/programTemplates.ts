/**
 * Program template helpers (Phase 28F — Program Library).
 * Pure, unit-testable: hashtag parsing/humanizing + best-effort mappings
 * from library goal/method names onto wizard ids.
 */

/** Parse a hashtag string ("#fat-loss #supersets") into raw tags (["fat-loss","supersets"]). */
export function parseTemplateTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(/\s+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean);
}

/** Humanize one tag: "fat-loss" → "Fat Loss". */
export function humanizeTag(tag: string): string {
  return tag
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Parse + humanize in one step. */
export function templateTagLabels(tags: string | null | undefined): string[] {
  return parseTemplateTags(tags).map(humanizeTag);
}

/**
 * Best-effort map: goals-table name → wizard GOALS id.
 * Mirrors the wizard's GOAL_MAP conventions (e.g. recomposition → fatloss).
 * First scored goal whose name matches one of these wins; otherwise the
 * wizard default goal stays untouched (documented in the ?template= effect).
 */
export const TEMPLATE_GOAL_MAP: Array<[RegExp, string]> = [
  [/hypertrophy|muscle/i, "hypertrophy"],
  [/fat.?loss|recomposition/i, "fatloss"],
  [/strength/i, "strength"],
  [/conditioning|endurance/i, "endurance"],
  [/power|performance/i, "power"],
  [/rehab/i, "rehab"],
];

/** Best-effort map: methods-table name → wizard METHODS id. */
export const TEMPLATE_METHOD_MAP: Array<[RegExp, string]> = [
  [/german volume|10x10/i, "german-volume"],
  [/5\s?x\s?5|stronglift/i, "5x5"],
  [/hiit|interval|circuit|metabolic/i, "hiit"],
  [/conjugate/i, "conjugate"],
  [/triphasic/i, "triphasic"],
];

/** First wizard id whose pattern matches the name, else null. */
export function mapTemplateNameToId(
  name: string,
  map: Array<[RegExp, string]>
): string | null {
  for (const [re, id] of map) {
    if (re.test(name)) return id;
  }
  return null;
}

/** Top-scored names from a list of { name, score } rows (desc), first mappable wins. */
export function bestMappedId(
  scored: Array<{ name: string; score: number }>,
  map: Array<[RegExp, string]>
): string | null {
  for (const row of scored) {
    const id = mapTemplateNameToId(row.name, map);
    if (id) return id;
  }
  return null;
}
