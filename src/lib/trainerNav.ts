// ═══════════════════════════════════════════════════════════════
// trainerNav (Phase 89) — curated trainer navigation model + pure
// visibility logic for the Vault-style nav shell (Item 1 & 2).
//
// NAV ITEMS: exactly these 8, in this order (owner-curated). The
// trainer's many other routes (messages, exercises, library, weekly
// digest, check-ins, …) stay reachable via deep links / in-page
// widgets — they are intentionally NOT in this nav.
//
// ROUTE MAPPING (documented for PROGRESS.md):
//   "Plan Summary" has no standalone route in the pre-89 app — the
//   screen lives per-client at /clients/:id?tab=plansummary
//   (PlanSummaryTab, Phase 61). Item 7 therefore points at the new
//   /plan-summary index page (Phase 89), which lists the trainer's
//   roster and deep-links each client to that existing tab.
//
// PERSISTENCE: profiles.nav_preferences JSONB (additive, Phase 89):
//   { "hidden": ["analytics", "sheets"] }  — item ids.
//   NULL / missing / malformed = all items visible (default).
//   "dashboard" is PERMANENT: normalizeNavPreferences drops it even
//   if a stored row tries to hide it, so it can never disappear.
// ═══════════════════════════════════════════════════════════════

import {
  LayoutDashboard,
  Brain,
  Users,
  Calendar as CalendarIcon,
  BarChart3,
  Table2,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface TrainerNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Permanent items (Dashboard) have no visibility toggle. */
  permanent: boolean;
}

export const TRAINER_NAV_ITEMS: TrainerNavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, permanent: true },
  { id: "coach", label: "Coach", path: "/coach", icon: Brain, permanent: false },
  { id: "clients", label: "Clients", path: "/clients", icon: Users, permanent: false },
  { id: "schedule", label: "Schedule", path: "/schedule", icon: CalendarIcon, permanent: false },
  { id: "analytics", label: "Analytics", path: "/analytics", icon: BarChart3, permanent: false },
  { id: "sheets", label: "Sheets", path: "/sheets", icon: Table2, permanent: false },
  { id: "plan-summary", label: "Plan Summary", path: "/plan-summary", icon: FileText, permanent: false },
  { id: "settings", label: "Settings", path: "/settings", icon: Settings, permanent: false },
];

const KNOWN_TOGGLEABLE_IDS = new Set(
  TRAINER_NAV_ITEMS.filter((i) => !i.permanent).map((i) => i.id),
);

/**
 * Validate raw persisted JSON into a clean hidden-id list.
 * Honest defaults: anything malformed → [] (all visible). Unknown
 * ids, non-strings, duplicates, and the permanent "dashboard" id are
 * all dropped — a corrupt row can never break or empty the nav.
 */
export function normalizeNavPreferences(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  let hidden: unknown = raw;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    hidden = (raw as Record<string, unknown>).hidden;
  }
  // Bare arrays are accepted defensively too — anything else is not a list.
  if (!Array.isArray(hidden)) return [];
  const out: string[] = [];
  for (const entry of hidden) {
    if (typeof entry !== "string") continue;
    if (!KNOWN_TOGGLEABLE_IDS.has(entry)) continue;
    if (!out.includes(entry)) out.push(entry);
  }
  return out;
}

/** Items in canonical order, minus the hidden ones. */
export function visibleNavItems(hiddenIds: string[]): TrainerNavItem[] {
  const hidden = new Set(hiddenIds);
  return TRAINER_NAV_ITEMS.filter((item) => item.permanent || !hidden.has(item.id));
}

/** Stable "hide this id" toggle for edit mode. */
export function toggleHiddenId(hiddenIds: string[], id: string): string[] {
  return hiddenIds.includes(id)
    ? hiddenIds.filter((h) => h !== id)
    : [...hiddenIds, id];
}

/** Shape written back to profiles.nav_preferences. */
export function toNavPreferences(hiddenIds: string[]): { hidden: string[] } {
  return { hidden: normalizeNavPreferences(hiddenIds) };
}
