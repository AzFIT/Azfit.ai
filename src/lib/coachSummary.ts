// ═══════════════════════════════════════════════════════════════
// coachSummary (Phase 90) — pure, deterministic summary math for the
// Vault-style coach dashboard header block. RULE-BASED only; every
// number traces to real rows (sessions / workout_logs / clients /
// ClientHealthGrid statuses). Unit-tested.
//
// SIGNAL REUSE (per phase spec — "reuse, don't duplicate"):
//  · Inactivity signal = the Coach AI Daily Brief's exact definition
//    (src/lib/coachBrief.ts): no workout_logs row with completed_at
//    within the last 7 days (or never completed one). daysSinceLast
//    is computed from completed_at, NOT created_at.
//  · Health statuses come from the existing useClientHealth /
//    ClientHealthGrid computation (passed in as props) — this lib
//    never re-derives them.
//  · Week-over-week delta reuses wowDeltaPct from dashboardBento.
//
// COMPLIANCE FORMULA (documented for PROGRESS.md):
//    For each non-archived client c, scheduled(c) = this-week
//    (Mon 00:00 local → next Mon 00:00 local) sessions owned by c
//    with status scheduled|completed (cancelled = off the books,
//    requested = not yet accepted — both excluded from the
//    denominator). Ownership: sessions.client_record_id = c.id, or
//    (when the session has no clients-row key) sessions.client_id =
//    c's auth profile id. Eligible clients = { c : scheduled(c) > 0 }.
//    compliance% = Σ completed(eligible) ÷ Σ scheduled(eligible) × 100.
//    Clients with zero scheduled sessions are EXCLUDED from the
//    denominator — missing data never scores 0%. No eligible clients
//    → null (the UI renders an honest empty state, not 0%).
// ═══════════════════════════════════════════════════════════════

import { wowDeltaPct } from "./dashboardBento";
import { formatDateKeyLocal } from "./utils";

/* ── Inputs (all plain data — fetch-agnostic) ─────────────────── */

export interface SummaryClient {
  /** clients.id */
  id: string;
  fullName: string;
  /** clients.status (archived rows are filtered out by the caller) */
  status: string;
  /** auth profile id for this client (via profiles.email = clients.email), null when account-less */
  profileId: string | null;
}

export interface SummarySession {
  /** sessions.client_id (auth profile id) — null for account-less. Wire format = DB column names. */
  client_id: string | null;
  /** sessions.client_record_id (clients.id) — null pre-intake pairing */
  client_record_id: string | null;
  status: string;
  /** ISO timestamp */
  starts_at: string;
}

export interface CompletedLog {
  client_id: string;
  completed_at: string;
}

export interface WeekWindow {
  start: Date;
  end: Date;
}

const DAY_MS = 86400000;

/** Monday-start local week window. weekOffset 0 = current week. */
export function localWeekWindow(weekOffset: number, now = new Date()): WeekWindow {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const shifted = new Date(start.getTime() - Math.max(0, weekOffset) * 7 * DAY_MS);
  return { start: shifted, end: new Date(shifted.getTime() + 7 * DAY_MS) };
}

export function inWindow(iso: string, w: WeekWindow): boolean {
  const t = new Date(iso).getTime();
  return t >= w.start.getTime() && t < w.end.getTime();
}

/* ── Alert strip: no completed workout in 7+ days ─────────────── */

export interface InactiveClient {
  id: string;
  firstName: string;
}

/**
 * Same inactivity signal as the Coach AI brief: latest workout_logs
 * completed_at per client; inactive when null (never) or ≥7 days old.
 */
export function inactiveClients(
  roster: SummaryClient[],
  logs: CompletedLog[],
  now = new Date(),
): InactiveClient[] {
  const sevenDaysAgo = now.getTime() - 7 * DAY_MS;
  const latest = new Map<string, number>();
  for (const log of logs) {
    const t = new Date(log.completed_at).getTime();
    if (Number.isNaN(t)) continue;
    const prev = latest.get(log.client_id);
    if (prev === undefined || t > prev) latest.set(log.client_id, t);
  }
  const out: InactiveClient[] = [];
  for (const c of roster) {
    // workout_logs.client_id REFERENCES clients(id) — keyed by the roster row.
    const last = latest.get(c.id);
    if (last === undefined || last < sevenDaysAgo) {
      const first = c.fullName.trim().split(/\s+/)[0] ?? c.fullName;
      out.push({ id: c.id, firstName: first });
    }
  }
  return out;
}

/* ── Sessions this week ───────────────────────────────────────── */

/** Non-cancelled sessions in the window (on-the-books count). */
export function sessionsThisWeek(sessions: SummarySession[], w: WeekWindow): number {
  return sessions.filter((s) => s.status !== "cancelled" && inWindow(s.starts_at, w)).length;
}

/** Sessions still to come TODAY (local day, status scheduled, future start). */
export function remainingToday(sessions: SummarySession[], now = new Date()): number {
  const todayKey = formatDateKeyLocal(now);
  return sessions.filter((s) => {
    if (s.status !== "scheduled") return false;
    if (new Date(s.starts_at).getTime() <= now.getTime()) return false;
    return formatDateKeyLocal(new Date(s.starts_at)) === todayKey;
  }).length;
}

/* ── Compliance ───────────────────────────────────────────────── */

export interface ComplianceResult {
  /** null = no client had a scheduled session this week (honest empty) */
  pct: number | null;
  completed: number;
  scheduled: number;
}

function owns(session: SummarySession, client: SummaryClient): boolean {
  if (session.client_record_id) return session.client_record_id === client.id;
  return client.profileId !== null && session.client_id === client.profileId;
}

const DENOMINATOR_STATUSES = new Set(["scheduled", "completed"]);

/**
 * completed ÷ scheduled for THIS week, restricted to clients who had
 * at least one scheduled session (zero-scheduled clients excluded —
 * they are missing data, not 0% performers).
 */
export function weekCompliance(
  sessions: SummarySession[],
  roster: SummaryClient[],
  w: WeekWindow,
): ComplianceResult {
  let completed = 0;
  let scheduled = 0;
  for (const client of roster) {
    const mine = sessions.filter(
      (s) => owns(s, client) && inWindow(s.starts_at, w) && DENOMINATOR_STATUSES.has(s.status),
    );
    if (mine.length === 0) continue; // zero-scheduled → excluded from denominator
    scheduled += mine.length;
    completed += mine.filter((s) => s.status === "completed").length;
  }
  if (scheduled === 0) return { pct: null, completed: 0, scheduled: 0 };
  return { pct: Math.round((completed / scheduled) * 100), completed, scheduled };
}

/** "+/-N% vs last week" — null when last week has no comparable base. */
export function complianceDelta(thisWeek: ComplianceResult, lastWeek: ComplianceResult): number | null {
  if (thisWeek.pct === null || lastWeek.pct === null) return null;
  return wowDeltaPct(thisWeek.pct, lastWeek.pct);
}

/* ── Needs attention / on track (from ClientHealthGrid statuses) ── */

export interface HealthLike {
  name: string;
  status: string;
}

const ATTENTION_STATUSES = new Set(["needs_attention", "at_risk"]);

export function needsAttentionSummary(healthClients: HealthLike[]): { count: number; topNames: string[] } {
  const flagged = healthClients.filter((c) => ATTENTION_STATUSES.has(c.status));
  // at_risk sorts above needs_attention; then alphabetical for stability.
  const rank = (s: string) => (s === "at_risk" ? 0 : 1);
  const sorted = [...flagged].sort(
    (a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name),
  );
  return { count: flagged.length, topNames: sorted.slice(0, 3).map((c) => c.name) };
}

/** "X of Y on track" — deload counts separately, not as on-track. */
export function onTrackSummary(healthClients: HealthLike[], rosterSize: number): { onTrack: number; total: number } {
  const onTrack = healthClients.filter((c) => c.status === "on_track").length;
  return { onTrack, total: rosterSize };
}
