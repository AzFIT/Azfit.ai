-- ============================================================
-- Phase 97a: AI chat backend — ai_config + key-management RPCs
--
-- SECURITY MODEL (permanent):
--  · ai_config holds the trainer's OWN AI provider key (OpenAI-compatible
--    — OpenAI and Moonshot/Kimi both speak /chat/completions). NO key
--    exists in the repo and none may ever be committed; the trainer
--    pastes it at runtime.
--  · RLS is enabled with ZERO policies: authenticated roles (trainer OR
--    client, owner or not) cannot SELECT/INSERT/UPDATE/DELETE at all.
--    Only the service role — i.e. the ai-chat edge function — reads it.
--  · The app UI never receives the key back. Writes go through
--    save_ai_config (shape-validated, SECURITY DEFINER, auth.uid()
--    scoped); display is presence-only via has_ai_config().
--  · A client caller of ai-chat uses THEIR TRAINER's key (spend is the
--    trainer's, by design — the quick-log chat is a trainer-provided
--    perk). The edge function resolves trainer_id from the caller.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_config (
  trainer_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: zero access for authenticated/anon roles.

-- Shape-validated upsert of the caller's own row. Never returns the key.
CREATE OR REPLACE FUNCTION public.save_ai_config(p_api_key TEXT, p_base_url TEXT, p_model TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_api_key IS NULL OR length(trim(p_api_key)) < 8 THEN
    RAISE EXCEPTION 'api_key must be at least 8 characters';
  END IF;
  IF p_base_url IS NULL OR trim(p_base_url) !~* '^https://.+' THEN
    RAISE EXCEPTION 'base_url must be an https URL';
  END IF;
  IF p_model IS NULL OR length(trim(p_model)) = 0 THEN
    RAISE EXCEPTION 'model is required';
  END IF;
  INSERT INTO public.ai_config (trainer_id, api_key, base_url, model, updated_at)
  VALUES (auth.uid(), trim(p_api_key), rtrim(trim(p_base_url), '/'), trim(p_model), now())
  ON CONFLICT (trainer_id) DO UPDATE SET
    api_key = EXCLUDED.api_key,
    base_url = EXCLUDED.base_url,
    model = EXCLUDED.model,
    updated_at = now();
  RETURN true;
END;
$function$;

-- Remove the caller's own row (Settings "Clear key").
CREATE OR REPLACE FUNCTION public.clear_ai_config()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  DELETE FROM public.ai_config WHERE trainer_id = auth.uid();
  RETURN true;
END;
$function$;

-- Presence-only boolean for the Settings UI ("Key saved ········").
CREATE OR REPLACE FUNCTION public.has_ai_config()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.ai_config WHERE trainer_id = auth.uid());
$function$;

-- SECURITY DEFINER functions are PUBLIC-callable by default — lock down
-- EXECUTE to authenticated only (anon gets nothing).
REVOKE ALL ON FUNCTION public.save_ai_config(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_ai_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_ai_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_ai_config(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_ai_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_ai_config() TO authenticated;
