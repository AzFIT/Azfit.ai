-- ============================================================
-- Phase 26E: editable phase label on programs
-- Nullable, no default — cards fall back to "Program Phase" when unset.
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS phase_name text;
