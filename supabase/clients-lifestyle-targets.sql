-- ============================================================
-- Phase 55: client-editable lifestyle targets (steps/sleep/water).
-- 1) clients.lifestyle_targets jsonb NULL — { steps, sleep_hours,
--    water_ml } (all keys optional). This is the first per-client
--    home for water/steps/sleep targets (54 confirmed none existed).
-- 2) Narrow client self-UPDATE policy. Postgres has no column-level
--    RLS, so the policy is row-scoped (own record via the existing
--    profiles-email identity path) and the app updates ONLY the
--    lifestyle_targets column (single-column update, documented in
--    PROGRESS.md). Column-level GRANT was rejected: Supabase's
--    authenticated role already has table-level UPDATE and revoking
--    it would break every trainer path.
-- Applied live via pooler; mirror appended to schema.sql.
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lifestyle_targets jsonb NULL;

CREATE POLICY "Clients can update own lifestyle targets"
  ON public.clients FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.email = clients.email
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.email = clients.email
    )
  );
