// Phase 91 — dashboard customization preferences: pure shape, normalization,
// and order/hide operations. One JSONB (profiles.dashboard_preferences) holds
// THREE preference docs — trainer-dashboard cards, client-profile sections,
// and privacy mode — so Phase 92's collapsibles can extend this exact shape.
//
// Shape (stored server-side, per user):
//   {
//     cards:           { hidden: string[], order: string[] },
//     profileSections: { hidden: string[], order: string[] },
//     privacy:         { enabled: boolean, autoReblurSec: number | null }
//   }
// NULL column = default layout everywhere (zero visual change).
// autoReblurSec: null = never auto re-blur.

export interface OrderHidePrefs {
  hidden: string[];
  order: string[];
}

export interface PrivacyPrefs {
  enabled: boolean;
  /** seconds of no pointer/keyboard activity before privacy re-engages; null = never */
  autoReblurSec: number | null;
}

export interface DashboardPreferences {
  cards: OrderHidePrefs;
  profileSections: OrderHidePrefs;
  privacy: PrivacyPrefs;
}

export const DEFAULT_PRIVACY: PrivacyPrefs = {
  enabled: false,
  autoReblurSec: null,
};

const isStrArr = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string");

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Unknown-id tolerant + duplicate-safe normalization. `knownIds` is the
 * current registry; ids that no longer exist are dropped, missing ones are
 * appended in registry order so a stale stored order never loses a card.
 */
export function normalizeOrderHide(
  raw: unknown,
  knownIds: string[]
): OrderHidePrefs {
  const rec = asRecord(raw);
  const rawOrder = rec && isStrArr(rec.order) ? rec.order : [];
  const rawHidden = rec && isStrArr(rec.hidden) ? rec.hidden : [];
  const known = new Set(knownIds);

  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of rawOrder) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of knownIds) {
    if (!seen.has(id)) order.push(id);
  }

  const hidden = [...new Set(rawHidden.filter((id) => known.has(id)))];
  return { hidden, order };
}

export function normalizePrivacy(raw: unknown): PrivacyPrefs {
  const rec = asRecord(raw);
  if (!rec) return { ...DEFAULT_PRIVACY };
  const enabled = typeof rec.enabled === "boolean" ? rec.enabled : false;
  const ar = rec.autoReblurSec;
  const autoReblurSec =
    typeof ar === "number" && Number.isFinite(ar) && ar > 0 ? Math.floor(ar) : null;
  return { enabled, autoReblurSec };
}

/** Normalize a raw JSONB value (or NULL) against both registries. */
export function normalizeDashboardPreferences(
  raw: unknown,
  cardIds: string[],
  sectionIds: string[]
): DashboardPreferences {
  const rec = asRecord(raw);
  return {
    cards: normalizeOrderHide(rec ? rec.cards : null, cardIds),
    profileSections: normalizeOrderHide(rec ? rec.profileSections : null, sectionIds),
    privacy: normalizePrivacy(rec ? rec.privacy : null),
  };
}

/* ── Pure order/hide operations (all duplicate-safe, unknown-id tolerant) ── */

export function hideId(prefs: OrderHidePrefs, id: string): OrderHidePrefs {
  if (prefs.hidden.includes(id)) return prefs;
  return { ...prefs, hidden: [...prefs.hidden, id] };
}

export function showId(prefs: OrderHidePrefs, id: string): OrderHidePrefs {
  return { ...prefs, hidden: prefs.hidden.filter((h) => h !== id) };
}

export function toggleHiddenId(prefs: OrderHidePrefs, id: string): OrderHidePrefs {
  return prefs.hidden.includes(id) ? showId(prefs, id) : hideId(prefs, id);
}

/**
 * Move `id` one slot toward the start (delta = -1) or end (+1) of the order.
 * No-op for unknown ids or when already at the edge.
 */
export function moveId(
  prefs: OrderHidePrefs,
  id: string,
  delta: -1 | 1
): OrderHidePrefs {
  const idx = prefs.order.indexOf(id);
  if (idx < 0) return prefs;
  const to = idx + delta;
  if (to < 0 || to >= prefs.order.length) return prefs;
  const order = [...prefs.order];
  [order[idx], order[to]] = [order[to], order[idx]];
  return { ...prefs, order };
}

/** Ordered ids that are currently visible (hidden removed). */
export function visibleOrder(prefs: OrderHidePrefs): string[] {
  const hidden = new Set(prefs.hidden);
  return prefs.order.filter((id) => !hidden.has(id));
}
