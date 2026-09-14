// Phase 92 — CollapsiblePanel header badges. Honest-data rule: a badge
// only renders when there is a real, positive count behind it — returning
// null lets the panel header omit the badge entirely (a "0 remaining"
// badge is noise; no badge is better than a zero badge).

export type PanelBadgeTone = "neutral" | "warning" | "danger";

export interface PanelBadge {
  text: string;
  tone: PanelBadgeTone;
}

/**
 * Singular/plural count badge, e.g. countBadge(2, "session remaining",
 * "sessions remaining") → { text: "2 sessions remaining", tone }.
 * Returns null for count <= 0 or non-finite input — the caller hides
 * the badge slot instead of rendering a zero.
 */
export function countBadge(
  count: number,
  singular: string,
  plural: string,
  tone: PanelBadgeTone = "neutral"
): PanelBadge | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return { text: `${count} ${count === 1 ? singular : plural}`, tone };
}
