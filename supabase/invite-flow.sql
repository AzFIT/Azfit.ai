-- ============================================================
-- Phase 28A: client invite flow
-- 1) get_trainer_display_name(uuid) — SECURITY DEFINER, returns
--    ONLY full_name so anonymous invite visitors can see who
--    invited them without profiles RLS exposure.
-- 2) current_user_email() — SECURITY DEFINER helper returning the
--    caller's auth email (the INSERT policy's email check can't
--    subquery auth.users directly — authenticated has no SELECT
--    privilege on it).
-- 3) "Invited clients can create own record" INSERT policy —
--    a new user can create a clients row ONLY for their own
--    auth email (auto-link on signup/login via ?trainer=).
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_trainer_display_name(p_trainer_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT full_name FROM public.profiles WHERE id = p_trainer_id;
$function$;

REVOKE ALL ON FUNCTION public.get_trainer_display_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trainer_display_name(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_trainer_display_name(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT email FROM auth.users WHERE id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.current_user_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;

-- Invited signups create their OWN clients row (email must match auth email)
CREATE POLICY "Invited clients can create own record"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    email = public.current_user_email()
    AND trainer_id IS NOT NULL
  );
