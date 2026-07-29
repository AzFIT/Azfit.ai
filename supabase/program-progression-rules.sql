-- ============================================================
-- Phase 30D: progression rules on programs
-- Nullable jsonb array of rule objects [{ id?, label, text }]
-- No default — old rows keep NULL and rehydrate to an empty list.
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS progression_rules jsonb;
