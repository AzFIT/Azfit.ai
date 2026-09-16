-- Phase 99a — client invitation system.
-- Item 3 gap found during smoke: the account->client row linkage used by
-- RLS is an email join (clients.email = profiles.email) and ALL 35
-- client-visible policies across 26 tables are CASE-SENSITIVE. Supabase
-- lowercases auth emails, so any clients row holding mixed-case email
-- (typed by a trainer, imported, or invited at a different casing) silently
-- fails every policy — the client logs in to an empty shell.
--
-- Fix (minimal, one place): enforce the invariant "clients.email is always
-- lowercase", which auth already guarantees for profiles.email.
--   1. Normalize the (single) existing mixed-case row.
--   2. Trigger lowercases email on every clients INSERT/UPDATE, so the 35
--      existing case-sensitive policies become correct by construction.
-- The client-side .ilike sweep (27 call sites) stays as defense-in-depth.

BEGIN;

-- 1. Normalize existing rows (email local-parts are treated as
--    case-insensitive throughout the app; auth already lowercases).
UPDATE public.clients
SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);

-- 2. Keep the invariant at the door.
CREATE OR REPLACE FUNCTION public.clients_email_lowercase()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_email_lowercase ON public.clients;
CREATE TRIGGER clients_email_lowercase
  BEFORE INSERT OR UPDATE OF email ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_email_lowercase();

COMMIT;
