-- ============================================================
-- Phase 23: trainer-private client notes
-- Coach notes are PRIVATE by default (Phase 18B lesson): trainer-only
-- policies, NO client policies at all (default deny).
-- Keys on clients(id) — uses is_my_client_id (takes clients.id),
-- NOT is_my_client (that one takes profiles.id).
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- Trainers only (default deny for everyone else, incl. the client)
CREATE POLICY "Trainers can read their client notes"
  ON public.client_notes FOR SELECT TO authenticated
  USING (public.is_trainer() AND public.is_my_client_id(client_id));

CREATE POLICY "Trainers can add notes to their clients"
  ON public.client_notes FOR INSERT TO authenticated
  WITH CHECK (
    trainer_id = auth.uid()
    AND public.is_trainer() AND public.is_my_client_id(client_id)
  );

CREATE POLICY "Trainers can update their client notes"
  ON public.client_notes FOR UPDATE TO authenticated
  USING (public.is_trainer() AND public.is_my_client_id(client_id))
  WITH CHECK (
    trainer_id = auth.uid()
    AND public.is_trainer() AND public.is_my_client_id(client_id)
  );

CREATE POLICY "Trainers can delete their client notes"
  ON public.client_notes FOR DELETE TO authenticated
  USING (public.is_trainer() AND public.is_my_client_id(client_id));
