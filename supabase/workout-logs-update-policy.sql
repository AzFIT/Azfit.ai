-- ============================================================
-- Phase 35 ITEM 1: workout_logs UPDATE policies
-- ROOT CAUSE of "Finish doesn't save": workout_logs had only
-- INSERT + SELECT policies — the completion update (completed_at,
-- duration_minutes, notes) silently matched zero rows for every role.
-- Mirrors the existing email-match / is_my_client_id patterns.
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

CREATE POLICY "Clients can update their logs" ON public.workout_logs
  FOR UPDATE TO public
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Trainers can update client logs" ON public.workout_logs
  FOR UPDATE TO public
  USING (is_my_client_id(client_id));
