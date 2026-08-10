/* ═══════════════════════════════════════════════════════════════
   Phase 60, Item 4 — Coach Daily Brief engine. RULE-BASED only —
   no LLM, no "AI" claims; every insight is deterministic from real
   data. Pure + unit-tested.
   ═══════════════════════════════════════════════════════════════ */

export type BriefSeverity = "alert" | "warning" | "info";

export interface BriefItem {
  id: string;
  severity: BriefSeverity;
  title: string;
  detail: string;
  action: { label: string; route: string };
}

export interface BriefClientInput {
  id: string;
  name: string;
  /** overdue check-in this week */
  checkinDue: boolean;
  /** completed workout_logs this week / last week */
  workoutsThisWeek: number;
  workoutsLastWeek: number;
  /** days since last completed workout; null = never logged one */
  daysSinceLastWorkout: number | null;
  hasActiveProgram: boolean;
  /** summed session-package credits remaining; null = no package */
  creditsRemaining: number | null;
}

export interface BriefContextInput {
  sessionsToday: number;
  clients: BriefClientInput[];
}

const SEVERITY_ORDER: Record<BriefSeverity, number> = { alert: 0, warning: 1, info: 2 };
const MAX_ITEMS = 5;

export function buildCoachBrief(input: BriefContextInput): BriefItem[] {
  const items: BriefItem[] = [];

  for (const c of input.clients) {
    // No completed workout in 7+ days (or never) → alert
    if (c.daysSinceLastWorkout === null || c.daysSinceLastWorkout >= 7) {
      items.push({
        id: `inactive-${c.id}`,
        severity: "alert",
        title: `${c.name} hasn't trained in ${c.daysSinceLastWorkout === null ? "a while" : `${c.daysSinceLastWorkout} days`}`,
        detail: "No completed workout in 7+ days.",
        action: { label: "Message", route: "/messages" },
      });
    }

    // Missed this week's check-in → warning
    if (c.checkinDue) {
      items.push({
        id: `checkin-${c.id}`,
        severity: "warning",
        title: `${c.name} missed this week's check-in`,
        detail: "Review and follow up before the week ends.",
        action: { label: "Review check-ins", route: "/check-ins" },
      });
    }

    // Adherence dropped vs last week (only when last week had activity)
    if (c.workoutsLastWeek > 0 && c.workoutsThisWeek < c.workoutsLastWeek) {
      items.push({
        id: `drop-${c.id}`,
        severity: "warning",
        title: `${c.name}'s training dropped`,
        detail: `${c.workoutsThisWeek} workout${c.workoutsThisWeek === 1 ? "" : "s"} this week vs ${c.workoutsLastWeek} last week.`,
        action: { label: "View client", route: `/client/${c.id}` },
      });
    }

    // No active program → info
    if (!c.hasActiveProgram) {
      items.push({
        id: `program-${c.id}`,
        severity: "info",
        title: `${c.name} has no active program`,
        detail: "A program keeps sessions purposeful — build or assign one.",
        action: { label: "Build program", route: `/ai-program-builder?clientId=${c.id}` },
      });
    }

    // Session credits running out → info
    if (c.creditsRemaining !== null && c.creditsRemaining <= 1) {
      items.push({
        id: `credits-${c.id}`,
        severity: "info",
        title: `${c.name} is ${c.creditsRemaining === 0 ? "out of" : "down to 1"} session credit${c.creditsRemaining === 1 ? "" : "s"}`,
        detail: "Time to renew their package.",
        action: { label: "View sessions", route: `/client/${c.id}?tab=schedule` },
      });
    }
  }

  // Sessions today — summary line → info
  if (input.sessionsToday > 0) {
    items.push({
      id: "today-sessions",
      severity: "info",
      title: `${input.sessionsToday} session${input.sessionsToday === 1 ? "" : "s"} on the calendar today`,
      detail: "Today's schedule at a glance.",
      action: { label: "Open schedule", route: "/schedule" },
    });
  }

  return items
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_ITEMS);
}

/* ── Confidence: deterministic data-completeness score ──────────
   % of roster with recent activity (a workout in the last 7 days
   OR a check-in this week). NOT model confidence. */
export function dataCompleteness(clients: BriefClientInput[]): number {
  if (clients.length === 0) return 0;
  const withRecent = clients.filter(
    (c) => (c.daysSinceLastWorkout !== null && c.daysSinceLastWorkout < 7) || !c.checkinDue,
  ).length;
  return Math.round((withRecent / clients.length) * 100);
}

export function confidenceLevel(percent: number): "High" | "Medium" | "Low" {
  if (percent >= 70) return "High";
  if (percent >= 40) return "Medium";
  return "Low";
}
