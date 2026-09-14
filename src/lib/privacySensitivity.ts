// Phase 91 — privacy sensitivity classification for trainer-dashboard cards.
// DOCUMENTED LIST (owner-approved shape; extend when Phase 97 lands):
//   SENSITIVE: needs-attention (top-3 client NAMES), client-compliance,
//     active-clients-roster (client NAMES), avg-compliance. Every
//     revenue-bearing surface joins this set once Phase 97 lands.
//   NON-SENSITIVE: active-clients (Phase 90 summary — bare count + "X of Y
//     on track" aggregate), sessions-week (bare count), today (timeline),
//     weekly-volume (aggregate load), coach-brief (rule-based aggregate
//     advice — no per-client figures).
// Keep in sync with DASHBOARD_CARDS in ./dashboardRegistry.

const SENSITIVE_CARDS: ReadonlySet<string> = new Set([
  "needs-attention",
  "client-compliance",
  "active-clients-roster",
  "avg-compliance",
]);

export function isSensitiveCard(cardId: string): boolean {
  return SENSITIVE_CARDS.has(cardId);
}
