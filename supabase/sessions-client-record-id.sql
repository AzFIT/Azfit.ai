-- ============================================================
-- Phase 35 ITEM 2: sessions for account-less clients
-- client_record_id references public.clients(id) — booking an
-- account-less client (no profiles row) sets this instead of client_id.
-- The existing "Trainers can manage their sessions" (ALL, trainer_id =
-- auth.uid()) already covers trainer access to these rows; the new
-- policy lets a client read them once they create an account (their
-- clients row matches by email).
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS client_record_id uuid NULL REFERENCES public.clients(id) ON DELETE CASCADE;

-- Account-less sessions carry client_record_id with client_id NULL
ALTER TABLE public.sessions ALTER COLUMN client_id DROP NOT NULL;

CREATE POLICY "Clients can view own-record sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    client_record_id IN (
      SELECT id FROM public.clients
      WHERE email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    )
  );
