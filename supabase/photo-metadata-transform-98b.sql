-- Phase 98b — Photo Compare & Align: per-photo transform persistence.
-- Additive only. Applied live 2026-09-17 via pooler; mirrored into schema.sql.
ALTER TABLE public.photo_metadata
  ADD COLUMN IF NOT EXISTS transform JSONB DEFAULT NULL;

COMMENT ON COLUMN public.photo_metadata.transform IS
  'Phase 98b: per-photo compare/align transform {x, y, scale} (JSONB). NULL = unmodified.';
