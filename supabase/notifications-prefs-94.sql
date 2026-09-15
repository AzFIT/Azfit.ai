-- Phase 94 — Notifications Infrastructure (plumbing)
-- Per-user notification preferences, persisted server-side (syncs across
-- devices). NULL = defaults (all types on, no quiet hours) — the zero-visual-
-- change rule for existing users. Enforced server-side at send time in
-- Phase 95; this phase stores only (per spec).
--
-- Shape (normalized by src/lib/notificationPrefs.ts on read AND write):
--   {
--     "types": { "session_reminder": true, "checkin_due": true,
--                "missed_workout": true, "streak_at_risk": true,
--                "achievement_unlocked": true },
--     "quietHours": { "from": "21:00", "to": "07:00" } | null
--   }
-- push on/off is NOT stored here — the master switch is the presence of a
-- push_subscriptions row for the device (Phase 24A pattern).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT NULL;
