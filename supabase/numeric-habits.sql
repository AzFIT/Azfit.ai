-- ═══════════════════════════════════════════════════════════════
-- Phase 85 — Numeric habit logging
-- Additive-only. Gives habits an optional numeric target + unit and
-- habit_logs an optional numeric value, so tiles can show real
-- "7.5 of 8 h" lines instead of the Phase 82 done-days fallback.
-- Existing rows are NEVER backfilled: habit_logs.value stays NULL
-- for all pre-Phase-85 rows (done-flag only), habits.target_value
-- stays NULL for all pre-existing flag-only habits.
-- RLS unchanged (column addition only; existing policies cover the
-- new columns — clients already insert/update/select their own
-- habit_logs rows).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS target_value NUMERIC,
  ADD COLUMN IF NOT EXISTS unit TEXT;

ALTER TABLE public.habit_logs
  ADD COLUMN IF NOT EXISTS value NUMERIC;

-- Honest-data guards: targets must be positive when set; logged
-- values must be non-negative when set. NULL = flag-only, always
-- allowed.
ALTER TABLE public.habits
  DROP CONSTRAINT IF EXISTS habits_target_value_positive;
ALTER TABLE public.habits
  ADD CONSTRAINT habits_target_value_positive
  CHECK (target_value IS NULL OR target_value > 0);

ALTER TABLE public.habit_logs
  DROP CONSTRAINT IF EXISTS habit_logs_value_nonnegative;
ALTER TABLE public.habit_logs
  ADD CONSTRAINT habit_logs_value_nonnegative
  CHECK (value IS NULL OR value >= 0);
