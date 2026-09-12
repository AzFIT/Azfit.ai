-- ═══════════════════════════════════════════════════════════════
-- Phase 88 Item 3 — Trainer cancel with reason
-- Additive-only: nullable TEXT cancel_reason on sessions.
-- Existing rows stay NULL (no fabricated reasons — honest-data rule).
-- Applied live 2026-09-12 via pooler; mirrored into schema.sql.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Sanity: existing rows unaffected
SELECT count(*) AS total_sessions,
       count(cancel_reason) AS rows_with_reason
FROM sessions;
