-- ============================================================
-- Phase 57: waitlist_emails — landing-page email capture.
-- Anonymous INSERT (format-checked at the DB; the app adds a
-- honeypot), NO anonymous read; trainer-only SELECT via the
-- existing public.is_trainer() SECURITY DEFINER.
-- First anon-INSERT policy in the project (pre-approved by brief).
-- Applied live via pooler; mirror appended to schema.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.waitlist_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous landing visitors) can join — format-checked
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist_emails FOR INSERT TO anon, authenticated
  WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Trainers read the waitlist (no anonymous reads anywhere)
CREATE POLICY "Trainers can read waitlist"
  ON public.waitlist_emails FOR SELECT TO authenticated
  USING (public.is_trainer());
