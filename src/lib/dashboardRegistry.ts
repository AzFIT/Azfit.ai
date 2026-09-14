// Phase 91 — registries for dashboard customization. Two ordered id lists:
// the trainer-dashboard cards (hide/reorder in the Dashboard Settings sheet)
// and the coach-view client-profile sections (hide/reorder via "Customize
// layout"). Order of each array = canonical render order (= current layout
// for cards; documented per section). Keep ids stable — they persist in
// profiles.dashboard_preferences JSONB.

export interface RegistryEntry {
  id: string;
  label: string;
}

/**
 * TRAINER DASHBOARD CARD REGISTRY — the real set, detected from
 * TrainerDashboard (spec listed 8; the real set is 9 because "Active
 * Clients" exists twice: the Phase 90 summary metric AND the Phase 59 bento
 * roster tile that renders client NAMES):
 *   summary group (CoachSummary, Phase 90):
 *     active-clients   "Active Clients"        count + "X of Y on track"
 *     sessions-week    "Sessions This Week"
 *     avg-compliance   "Avg Compliance"
 *     needs-attention  "Needs Attention"       top-3 client NAMES
 *   bento group (Phase 59 bento rows):
 *     today                  "Today"                TodayTimelineTile
 *     client-compliance      "Client Compliance"    ComplianceHeroTile
 *     active-clients-roster  "Active Clients (roster)" ActiveClientsTile, NAMES
 *     weekly-volume          "Weekly Volume"        WeeklyVolumeTile
 *     coach-brief            "Coach AI Daily Brief" CoachBriefTile
 * NOT registered (fixed, always rendered): the Phase 90 alert strip, the
 * conditional Needs Attention strip, NutritionCommandCenter, the Row C stat
 * tiles, ClientHealthGrid, FollowUpsWidget, Quick Actions.
 */
export const DASHBOARD_CARDS: RegistryEntry[] = [
  { id: "active-clients", label: "Active Clients" },
  { id: "sessions-week", label: "Sessions This Week" },
  { id: "avg-compliance", label: "Avg Compliance" },
  { id: "needs-attention", label: "Needs Attention" },
  { id: "today", label: "Today" },
  { id: "client-compliance", label: "Client Compliance" },
  { id: "active-clients-roster", label: "Active Clients (roster)" },
  { id: "weekly-volume", label: "Weekly Volume" },
  { id: "coach-brief", label: "Coach AI Daily Brief" },
];

/** Cards rendered inside CoachSummary's 4-across summary strip. */
export const SUMMARY_GROUP: string[] = [
  "active-clients",
  "sessions-week",
  "avg-compliance",
  "needs-attention",
];

/** Cards rendered in the bento registry grid when cards are customized. */
export const BENTO_GROUP: string[] = [
  "today",
  "client-compliance",
  "active-clients-roster",
  "weekly-volume",
  "coach-brief",
];

/**
 * COACH-VIEW CLIENT PROFILE SECTIONS — OverviewTab, canonical order =
 * current render order. `details` + `nutrition` share a 2-col grid in the
 * DEFAULT layout; when sections are customized the layout flattens to one
 * full-width section per row (documented — the default/NULL layout is
 * pixel-unchanged). One preference set per COACH (it is the coach's view of
 * any client), not per client.
 */
export const PROFILE_SECTIONS: RegistryEntry[] = [
  { id: "session-packages", label: "Session Packages" },
  { id: "consistency", label: "Consistency" },
  { id: "stats", label: "Stats Cards" },
  { id: "progress", label: "Progress to Goal" },
  { id: "lifestyle", label: "Lifestyle Targets" },
  { id: "details", label: "Profile Details" },
  { id: "nutrition", label: "Nutrition Targets" },
  { id: "body-composition", label: "Body Composition" },
];

export const DASHBOARD_CARD_IDS = DASHBOARD_CARDS.map((c) => c.id);
export const PROFILE_SECTION_IDS = PROFILE_SECTIONS.map((s) => s.id);

export function registryLabel(entries: RegistryEntry[], id: string): string {
  return entries.find((e) => e.id === id)?.label ?? id;
}
