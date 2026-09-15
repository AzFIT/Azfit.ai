/* ═══════════════════════════════════════════════════════════════
   Phase 94 — notification preferences (pure reducer, no I/O).

   Persisted in profiles.notifications JSONB (additive, DEFAULT NULL).
   NULL = defaults (all types on, no quiet hours) — zero visual change
   for existing users. Normalized on read AND write: unknown type ids
   dropped, malformed quiet hours nulled, missing types default ON.

   The MASTER switch is deliberately NOT here: on/off is the presence
   of a push_subscriptions row for the device (Phase 24A pattern) —
   these prefs govern WHICH notifications a subscribed device receives.
   Server-side enforcement (incl. quiet hours at send time) ships in
   Phase 95; this phase stores only (per spec).
   ═══════════════════════════════════════════════════════════════ */

export const NOTIFICATION_TYPES = [
  { id: "session_reminder", label: "Session Reminders", description: "Upcoming training sessions" },
  { id: "checkin_due", label: "Check-in Due", description: "Your check-in is waiting" },
  { id: "missed_workout", label: "Missed-Workout Alerts", description: "When a planned workout was skipped" },
  { id: "streak_at_risk", label: "Streak at Risk", description: "Warn before a consistency streak breaks" },
  { id: "achievement_unlocked", label: "Achievement Unlocked", description: "When you earn an achievement" },
] as const;

export type NotificationTypeId = (typeof NOTIFICATION_TYPES)[number]["id"];

export interface QuietHours {
  /** "HH:MM" 24-hour local time. */
  from: string;
  to: string;
}

export interface NotificationPrefs {
  types: Record<NotificationTypeId, boolean>;
  quietHours: QuietHours | null;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  types: {
    session_reminder: true,
    checkin_due: true,
    missed_workout: true,
    streak_at_risk: true,
    achievement_unlocked: true,
  },
  quietHours: null,
};

const TYPE_IDS = NOTIFICATION_TYPES.map((t) => t.id) as NotificationTypeId[];
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isQuietHours(v: unknown): v is QuietHours {
  if (typeof v !== "object" || v === null) return false;
  const q = v as Record<string, unknown>;
  if (typeof q.from !== "string" || typeof q.to !== "string") return false;
  if (!HM.test(q.from) || !HM.test(q.to)) return false;
  // from === to would mean "quiet all day" — almost always a mistake;
  // treated as malformed (null) rather than enforced.
  return q.from !== q.to;
}

/** Tolerant parse: anything malformed → defaults. Never throws. */
export function normalizeNotificationPrefs(raw: unknown): NotificationPrefs {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_NOTIFICATION_PREFS, types: { ...DEFAULT_NOTIFICATION_PREFS.types } };
  }
  const r = raw as Record<string, unknown>;
  const types = { ...DEFAULT_NOTIFICATION_PREFS.types };
  if (typeof r.types === "object" && r.types !== null) {
    for (const id of TYPE_IDS) {
      const v = (r.types as Record<string, unknown>)[id];
      if (typeof v === "boolean") types[id] = v;
    }
  }
  return { types, quietHours: isQuietHours(r.quietHours) ? { ...(r.quietHours as QuietHours) } : null };
}

export function setNotificationType(
  prefs: NotificationPrefs,
  id: NotificationTypeId,
  enabled: boolean,
): NotificationPrefs {
  return { ...prefs, types: { ...prefs.types, [id]: enabled } };
}

/** Invalid values leave prefs unchanged (honest — never half-apply). */
export function setQuietHours(prefs: NotificationPrefs, from: string, to: string): NotificationPrefs {
  if (!HM.test(from) || !HM.test(to) || from === to) return prefs;
  return { ...prefs, quietHours: { from, to } };
}

export function clearQuietHours(prefs: NotificationPrefs): NotificationPrefs {
  return { ...prefs, quietHours: null };
}

/**
 * Pure quiet-hours test against a Date (local time). Overnight windows
 * (from > to) wrap midnight. null = never quiet. Boundaries: the window
 * is [from, to) — 21:00–07:00 is quiet at 21:00:00 and free at 07:00:00.
 */
export function isQuietHoursTime(quietHours: QuietHours | null, at: Date): boolean {
  if (!quietHours) return false;
  const mins = at.getHours() * 60 + at.getMinutes();
  const [fh, fm] = quietHours.from.split(":").map(Number);
  const [th, tm] = quietHours.to.split(":").map(Number);
  const from = (fh ?? 0) * 60 + (fm ?? 0);
  const to = (th ?? 0) * 60 + (tm ?? 0);
  if (from === to) return false;
  return from < to ? mins >= from && mins < to : mins >= from || mins < to;
}
