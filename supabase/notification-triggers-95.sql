-- ============================================================
-- Phase 95 — Notification triggers (idempotency + evaluation)
-- Applied live via pooler; mirrored into supabase/schema.sql.
-- The PUSH SEND path is the notification-worker edge function
-- (supabase/functions/notification-worker) — deploy is an owner
-- action (no SUPABASE_ACCESS_TOKEN on the build machine).
-- ============================================================

-- ── Idempotency / audit log ─────────────────────────────────
-- Spec shape (id, user_id, type, ref_key, sent_at) + additive
-- suppressed_reason (NULL = actually sent) + created_at.
-- UNIQUE(user_id, type, ref_key): the same event never fires twice —
-- whether sent or suppressed, one row per event, forever.
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  ref_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  suppressed_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, type, ref_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Owner reads own log; owner inserts own rows (the app-fired
-- achievement path logs BEFORE sending, so a send failure can never
-- produce a duplicate notification later). No UPDATE/DELETE.
DROP POLICY IF EXISTS notification_log_select_own ON notification_log;
CREATE POLICY notification_log_select_own ON notification_log
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS notification_log_insert_own ON notification_log;
CREATE POLICY notification_log_insert_own ON notification_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Due-alerts evaluator ────────────────────────────────────
-- Returns one row per due alert across ALL account-having clients,
-- with suppression PRE-APPLIED in suppressed_reason:
--   'type_disabled' — the client's prefs toggle for this type is OFF
--   'quiet_hours'   — at_ falls inside the client's quiet-hours window
--   NULL            — sendable now
-- Already-logged events (sent OR suppressed) are excluded — the
-- UNIQUE key makes the whole pipeline idempotent end to end.
-- Quiet-hours semantics (documented choice): alerts whose moment
-- falls inside the window are DROPPED (logged suppressed), not
-- deferred — a deferred session reminder would be moot, and honest
-- suppression beats a stale one. Timezone: day boundaries and
-- quiet-hours are evaluated in the DATABASE timezone (UTC); the app
-- has no per-user timezone, so near-midnight local boundaries can
-- shift by the client's UTC offset (documented limitation).
CREATE OR REPLACE FUNCTION public.notification_due_alerts(at_ timestamptz DEFAULT now())
RETURNS TABLE (
  user_id uuid,
  type text,
  ref_key text,
  title text,
  body text,
  url text,
  suppressed_reason text
)
LANGUAGE sql STABLE
AS $$
WITH acct AS (
  -- Account-having clients (push targets). Email join is lower() on
  -- both sides: Supabase lowercases auth emails (permanent gotcha).
  SELECT c.id AS client_row_id, c.trainer_id, c.full_name, c.email, p.id AS profile_id
  FROM clients c
  JOIN profiles p ON lower(p.email) = lower(c.email)
  WHERE c.status IS DISTINCT FROM 'archived'
),
pref_rows AS (
  SELECT p.id AS profile_id, t.type,
    CASE COALESCE((p.notifications -> 'types' ->> t.type)::boolean, true)
      WHEN true THEN true ELSE false END AS enabled
  FROM profiles p
  CROSS JOIN (VALUES ('session_reminder'), ('checkin_due'), ('missed_workout'),
                      ('streak_at_risk'), ('achievement_unlocked')) AS t(type)
),
quiet_now AS (
  SELECT p.id AS profile_id
  FROM profiles p
  WHERE (p.notifications -> 'quietHours' ->> 'from') IS NOT NULL
    AND (p.notifications -> 'quietHours' ->> 'to') IS NOT NULL
    AND (p.notifications -> 'quietHours' ->> 'from') <> (p.notifications -> 'quietHours' ->> 'to')
    AND (
      CASE
        WHEN (p.notifications -> 'quietHours' ->> 'from') < (p.notifications -> 'quietHours' ->> 'to')
        THEN to_char(at_ AT TIME ZONE 'UTC', 'HH24:MI') >= (p.notifications -> 'quietHours' ->> 'from')
         AND to_char(at_ AT TIME ZONE 'UTC', 'HH24:MI') <  (p.notifications -> 'quietHours' ->> 'to')
        ELSE to_char(at_ AT TIME ZONE 'UTC', 'HH24:MI') >= (p.notifications -> 'quietHours' ->> 'from')
          OR to_char(at_ AT TIME ZONE 'UTC', 'HH24:MI') <  (p.notifications -> 'quietHours' ->> 'to')
      END
    )
),
due AS (
  -- (a) Session Reminder: starts within the next 60 min.
  SELECT s.client_id AS user_id, 'session_reminder'::text AS type, s.id::text AS ref_key,
    'Session starting soon'::text AS title,
    (trim(both from coalesce(nullif(s.title, ''), 'Your session')) || ' starts at '
      || to_char(s.starts_at AT TIME ZONE 'UTC', 'HH24:MI'))::text AS body,
    '/#/schedule'::text AS url
  FROM sessions s
  WHERE s.status = 'scheduled'
    AND s.client_id IS NOT NULL
    AND s.starts_at > at_
    AND s.starts_at <= at_ + interval '60 minutes'
  UNION ALL
  -- (b) Missed Workout: scheduled session more than 2h past its end.
  SELECT s.client_id, 'missed_workout', s.id::text,
    'Workout missed'::text,
    (trim(both from coalesce(nullif(s.title, ''), 'Your scheduled workout'))
      || ' didn''t happen — reschedule in one tap.')::text,
    '/#/schedule'
  FROM sessions s
  WHERE s.status = 'scheduled'
    AND s.client_id IS NOT NULL
    AND coalesce(s.ends_at, s.starts_at + interval '1 hour') < at_ - interval '2 hours'
  UNION ALL
  -- (c) Check-in Due: trainer has an active form and the client has no
  -- submission in the current Mon-start week (DB tz).
  SELECT a.profile_id, 'checkin_due',
    (f.id::text || ':' || date_trunc('week', (at_ AT TIME ZONE 'UTC')::date)::date::text),
    'Check-in waiting'::text,
    ('Your check-in "' || f.title || '" is waiting — it takes a minute.')::text,
    '/#/check-ins'
  FROM acct a
  JOIN check_in_forms f ON f.trainer_id = a.trainer_id AND f.active = true
  WHERE NOT EXISTS (
    SELECT 1 FROM check_in_submissions sub
    WHERE sub.form_id = f.id
      AND sub.client_id = a.client_row_id
      AND sub.submitted_at >= date_trunc('week', (at_ AT TIME ZONE 'UTC')::date)
  )
  UNION ALL
  -- (d) Streak at Risk: a live streak (>= 2 consecutive active days
  -- ending yesterday, Phase 83 computeStreaks semantics over the Phase
  -- 86 activity set: completed sessions + done habit logs + check-in
  -- submissions) and NOTHING logged today.
  SELECT st.profile_id, 'streak_at_risk',
    ('streak:' || (at_ AT TIME ZONE 'UTC')::date::text),
    'Streak at risk'::text,
    ('You''re on a ' || st.run_len || '-day streak — log today''s activity to keep it alive.')::text,
    '/#/dashboard'
  FROM (
    WITH active_days AS (
      SELECT a.profile_id, (s.starts_at AT TIME ZONE 'UTC')::date AS day
      FROM acct a
      JOIN sessions s ON (s.client_id = a.profile_id OR s.client_record_id = a.client_row_id)
      WHERE s.status = 'completed'
        AND s.starts_at >= at_ - interval '40 days'
      UNION
      SELECT a.profile_id, hl.log_date::date
      FROM acct a
      JOIN habit_logs hl ON hl.client_id = a.client_row_id
      WHERE hl.done = true
        AND hl.log_date >= ((at_ AT TIME ZONE 'UTC')::date - 40)
      UNION
      SELECT a.profile_id, (sub.submitted_at AT TIME ZONE 'UTC')::date
      FROM acct a
      JOIN check_in_submissions sub ON sub.client_id = a.client_row_id
      WHERE sub.submitted_at >= at_ - interval '40 days'
    ),
    day_flags AS (
      SELECT ad.profile_id, d::date AS day,
        EXISTS (SELECT 1 FROM active_days x WHERE x.profile_id = ad.profile_id AND x.day = d::date) AS active,
        d::date - (row_number() OVER (PARTITION BY ad.profile_id ORDER BY d::date))::int AS grp
      FROM (SELECT DISTINCT profile_id FROM active_days) ad
      CROSS JOIN LATERAL generate_series(
        ((at_ AT TIME ZONE 'UTC')::date - 40),
        (at_ AT TIME ZONE 'UTC')::date,
        interval '1 day'
      ) g(d)
    ),
    anchor AS (
      SELECT profile_id, grp,
        count(*) FILTER (WHERE active) AS run_len
      FROM day_flags f
      WHERE grp = CASE
        WHEN EXISTS (SELECT 1 FROM day_flags x
          WHERE x.profile_id = f.profile_id AND x.day = (at_ AT TIME ZONE 'UTC')::date AND x.active)
        THEN (SELECT grp FROM day_flags x WHERE x.profile_id = f.profile_id AND x.day = (at_ AT TIME ZONE 'UTC')::date)
        ELSE (SELECT grp FROM day_flags x WHERE x.profile_id = f.profile_id AND x.day = (at_ AT TIME ZONE 'UTC')::date - 1)
      END
      GROUP BY profile_id, grp
    )
    SELECT profile_id, run_len FROM anchor
  ) st
  WHERE st.run_len >= 2
    AND NOT EXISTS (
      SELECT 1 FROM sessions s2
      WHERE s2.client_id = st.profile_id
        AND s2.status = 'completed'
        AND (s2.starts_at AT TIME ZONE 'UTC')::date = (at_ AT TIME ZONE 'UTC')::date
    )
    AND NOT EXISTS (
      SELECT 1 FROM habit_logs hl2
      JOIN acct a2 ON a2.profile_id = st.profile_id
      WHERE hl2.client_id = a2.client_row_id AND hl2.done = true
        AND hl2.log_date::date = (at_ AT TIME ZONE 'UTC')::date
    )
    AND NOT EXISTS (
      SELECT 1 FROM check_in_submissions sub2
      JOIN acct a3 ON a3.profile_id = st.profile_id
      WHERE sub2.client_id = a3.client_row_id
        AND (sub2.submitted_at AT TIME ZONE 'UTC')::date = (at_ AT TIME ZONE 'UTC')::date
    )
)
SELECT d.user_id, d.type, d.ref_key, d.title, d.body, d.url,
  CASE
    WHEN pr.enabled = false THEN 'type_disabled'
    WHEN q.profile_id IS NOT NULL THEN 'quiet_hours'
    ELSE NULL
  END AS suppressed_reason
FROM due d
JOIN pref_rows pr ON pr.profile_id = d.user_id AND pr.type = d.type
LEFT JOIN quiet_now q ON q.profile_id = d.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM notification_log nl
  WHERE nl.user_id = d.user_id AND nl.type = d.type AND nl.ref_key = d.ref_key
);
$$;

-- The function aggregates alert data across ALL clients — not callable
-- by app roles. The worker uses the service role (bypasses grants).
REVOKE EXECUTE ON FUNCTION public.notification_due_alerts(timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notification_due_alerts(timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notification_due_alerts(timestamptz) FROM authenticated;
