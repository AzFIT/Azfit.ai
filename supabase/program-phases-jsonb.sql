-- ============================================================
-- Phase 30B: per-phase structure on programs
-- Nullable jsonb array of the wizard's phase objects
-- [{ id, name, weeks, focus, color, active, intensityTarget?, volumeTarget? }]
-- No default — old rows keep NULL and rehydrate via the single-phase fallback.
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS phases jsonb;
