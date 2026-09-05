-- ============================================================
-- Phase 68 Item 3c: per-user calendar completion emoji preference.
-- profiles IS the existing per-user table — one additive nullable
-- text column; the existing "Users can update own profile" RLS
-- policy covers it (no new policy needed, consistent with the
-- brief's standard pattern). Applied live via pooler; mirrored in
-- schema.sql; src/types/supabase.ts updated.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calendar_emoji TEXT NULL;
