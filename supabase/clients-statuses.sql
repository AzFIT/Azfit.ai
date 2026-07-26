-- ============================================================
-- Phase 27A: richer client status set (11 statuses)
-- 'on_hold' is replaced by 'paused' — live data verified: ZERO
-- on_hold rows exist, so the swap is safe. If any appear before
-- applying, run: UPDATE clients SET status='paused' WHERE status='on_hold';
-- Applied live via pooler; mirror in schema.sql + types.
-- ============================================================

ALTER TABLE clients DROP CONSTRAINT clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check
  CHECK (status = ANY (ARRAY[
    'active','inactive','paused','on_holiday','on_break','pending_start',
    'trial','cancelled','unavailable','transferred','archived'
  ]));
