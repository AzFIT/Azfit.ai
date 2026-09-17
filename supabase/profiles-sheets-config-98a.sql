-- ============================================================
-- Phase 98a — Google Sheets export: per-trainer export config doc.
-- profiles.sheets_config holds the auto-created spreadsheet identity +
-- last-export bookkeeping, written ONLY by the sheets-export edge
-- function (service role). Client code never writes it.
-- Shape: { spreadsheet_id, url, created_at, last_export_at, row_counts }
-- NULL = never exported.
-- Additive; existing rows untouched.
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sheets_config JSONB DEFAULT NULL;
