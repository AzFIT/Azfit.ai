-- ═══════════════════════════════════════════════════════════════════
-- Phase 90e — View As Client: on-behalf logging audit trail + RLS
-- Applied live: 2026-09-14 via pooler (project gcurvjprfwecbchreieu)
--
-- SEMANTICS: logged_by UUID NULL = self-logged; the trainer's auth uid =
-- logged on behalf. Additive only; existing client self-service policies
-- are untouched (policies OR together, and client inserts keep
-- logged_by NULL through the existing email-join policies).
--
-- RLS MODEL (trainer writes, proven in smoke):
--   INSERT/UPDATE WITH CHECK (
--     logged_by = auth.uid()                      -- stamps WHOSE hand wrote it
--     AND client_id IN (SELECT id FROM public.clients
--                        WHERE trainer_id = auth.uid())  -- only OWN clients
--   )
-- habit_logs needed BOTH INSERT and UPDATE because the habit toggle is an
-- upsert (onConflict habit_id,log_date) — an existing row's flip is an
-- UPDATE. check_in_submissions already had a trainer INSERT policy; it is
-- replaced to ALSO require logged_by stamping (all trainer-side entries are
-- on-behalf by definition), plus a new on-behalf UPDATE for editing this
-- week's entry. The existing review-update policy (form-trainer join) is
-- left intact and ORs with the new one.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.habit_logs
  ADD COLUMN IF NOT EXISTS logged_by UUID REFERENCES auth.users(id);
ALTER TABLE public.check_in_submissions
  ADD COLUMN IF NOT EXISTS logged_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.habit_logs.logged_by IS
  'Phase 90e: NULL = self-logged; trainer auth uid = logged on behalf (View As Client).';
COMMENT ON COLUMN public.check_in_submissions.logged_by IS
  'Phase 90e: NULL = self-logged; trainer auth uid = logged on behalf (View As Client).';

-- ── habit_logs: trainer on-behalf INSERT + UPDATE ──────────────────
DROP POLICY IF EXISTS "Trainers can insert habit logs for their clients" ON public.habit_logs;
CREATE POLICY "Trainers can insert habit logs for their clients"
  ON public.habit_logs FOR INSERT TO authenticated
  WITH CHECK (
    logged_by = auth.uid()
    AND client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Trainers can update habit logs for their clients" ON public.habit_logs;
CREATE POLICY "Trainers can update habit logs for their clients"
  ON public.habit_logs FOR UPDATE TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()))
  WITH CHECK (
    logged_by = auth.uid()
    AND client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid())
  );

-- ── check_in_submissions: replace trainer INSERT with stamped version ──
DROP POLICY IF EXISTS "Trainers can insert submissions for their clients" ON public.check_in_submissions;
CREATE POLICY "Trainers can insert submissions for their clients"
  ON public.check_in_submissions FOR INSERT TO authenticated
  WITH CHECK (
    logged_by = auth.uid()
    AND form_id IN (SELECT id FROM public.check_in_forms WHERE trainer_id = auth.uid())
    AND client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid())
  );

-- ── check_in_submissions: on-behalf UPDATE (edit this week's entry) ──
DROP POLICY IF EXISTS "Trainers can update submissions for their clients" ON public.check_in_submissions;
CREATE POLICY "Trainers can update submissions for their clients"
  ON public.check_in_submissions FOR UPDATE TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid())
  )
  WITH CHECK (
    logged_by = auth.uid()
    AND client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid())
  );
