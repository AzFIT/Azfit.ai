-- ============================================================
-- Phase 76 Item 1: demo_dashboard_stats() — powers the PUBLIC
-- /demo page with REAL aggregates from the demo trainer account.
--
-- Security model:
--   SECURITY DEFINER (bypasses RLS) but hard-scoped to the demo
--   trainer (resolved by email 'trainer@azfit.demo') — no other
--   trainer's data can ever be read through it. The payload is
--   non-sensitive only: counts, times, statuses, durations, and
--   client names shortened to "First L." — NO emails, DOBs,
--   notes, phone numbers, or full names.
--   anon + authenticated get EXECUTE; nothing else changes (RLS
--   on the underlying tables is untouched).
--
-- "Today"/"this month" use Asia/Shanghai — the app's operating
--   timezone (sessions store UTC; Phase 64 local-day convention).
-- Applied live via pooler; mirror appended to schema.sql.
-- ============================================================

-- Name shortener: "Alex Carter (DEMO)" → "Alex C." (parenthesized
-- segments stripped; single-word names pass through unchanged).
CREATE OR REPLACE FUNCTION public.demo_short_name(p_full_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_full_name IS NULL THEN NULL
    WHEN position(' ' IN regexp_replace(p_full_name, '\s*\([^)]*\)', '', 'g')) > 0
      THEN split_part(regexp_replace(p_full_name, '\s*\([^)]*\)', '', 'g'), ' ', 1)
        || ' ' || upper(left(split_part(regexp_replace(p_full_name, '\s*\([^)]*\)', '', 'g'), ' ', -1), 1)) || '.'
    ELSE regexp_replace(p_full_name, '\s*\([^)]*\)', '', 'g')
  END;
$function$;

CREATE OR REPLACE FUNCTION public.demo_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trainer uuid;
  v_active_clients int;
  v_workouts_month int;
  v_avg_minutes numeric;
  v_completed_month int;
  v_scheduled_month int;
  v_sessions_today jsonb;
  v_recent_completed jsonb;
  v_today date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
  v_month_start date := date_trunc('month', now() AT TIME ZONE 'Asia/Shanghai')::date;
BEGIN
  SELECT id INTO v_trainer FROM public.profiles WHERE email = 'trainer@azfit.demo';
  IF v_trainer IS NULL THEN
    RETURN jsonb_build_object('error', 'demo trainer not found');
  END IF;

  -- Active client count (real)
  SELECT count(*) INTO v_active_clients
  FROM public.clients
  WHERE trainer_id = v_trainer AND status = 'active';

  -- Workouts logged this month (real; logs belong to this trainer's clients)
  SELECT count(*) INTO v_workouts_month
  FROM public.workout_logs wl
  JOIN public.clients c ON c.id = wl.client_id
  WHERE c.trainer_id = v_trainer
    AND (wl.completed_at AT TIME ZONE 'Asia/Shanghai')::date >= v_month_start;

  -- Average session duration (completed sessions with a real duration)
  SELECT round(avg(EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60)) INTO v_avg_minutes
  FROM public.sessions
  WHERE trainer_id = v_trainer
    AND status = 'completed'
    AND ends_at > starts_at;

  -- Completion rate basis this month (completed vs scheduled)
  SELECT
    count(*) FILTER (WHERE status = 'completed'),
    count(*) FILTER (WHERE status = 'scheduled')
  INTO v_completed_month, v_scheduled_month
  FROM public.sessions
  WHERE trainer_id = v_trainer
    AND (starts_at AT TIME ZONE 'Asia/Shanghai')::date >= v_month_start;

  -- Sessions today (time, title, status, "First L." only)
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.start_time), '[]'::jsonb)
  INTO v_sessions_today
  FROM (
    SELECT
      to_char(s.starts_at AT TIME ZONE 'Asia/Shanghai', 'HH24:MI') AS start_time,
      s.title,
      s.status,
      COALESCE(
        (SELECT public.demo_short_name(c.full_name) FROM public.clients c WHERE c.id = s.client_record_id),
        (SELECT public.demo_short_name(p.full_name) FROM public.profiles p WHERE p.id = s.client_id),
        'Client'
      ) AS client
    FROM public.sessions s
    WHERE s.trainer_id = v_trainer
      AND (s.starts_at AT TIME ZONE 'Asia/Shanghai')::date = v_today
      AND s.status <> 'cancelled'
  ) t;

  -- 4 most recent completed sessions ("First L.", title, duration)
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.starts_at DESC), '[]'::jsonb)
  INTO v_recent_completed
  FROM (
    SELECT
      s.starts_at,
      s.title,
      round(EXTRACT(EPOCH FROM (s.ends_at - s.starts_at)) / 60)::int AS duration_min,
      COALESCE(
        (SELECT public.demo_short_name(c.full_name) FROM public.clients c WHERE c.id = s.client_record_id),
        (SELECT public.demo_short_name(p.full_name) FROM public.profiles p WHERE p.id = s.client_id),
        'Client'
      ) AS client
    FROM public.sessions s
    WHERE s.trainer_id = v_trainer
      AND s.status = 'completed'
      AND s.ends_at > s.starts_at
    ORDER BY s.starts_at DESC
    LIMIT 4
  ) t;

  RETURN jsonb_build_object(
    'active_clients', v_active_clients,
    'workouts_this_month', v_workouts_month,
    'avg_session_minutes', v_avg_minutes,
    'completed_this_month', v_completed_month,
    'scheduled_this_month', v_scheduled_month,
    'sessions_today', v_sessions_today,
    'recent_completed', v_recent_completed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.demo_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.demo_dashboard_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.demo_dashboard_stats() TO authenticated;
