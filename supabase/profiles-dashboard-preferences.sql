-- Phase 91 — Dashboard customization + privacy blur (additive only).
-- One JSONB for dashboard cards, client-profile sections, and privacy mode;
-- Phase 92's collapsibles will reuse this exact shape.
-- Applied live 2026-09-14 via pooler to gcurvjprfwecbchreieu.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_preferences JSONB DEFAULT NULL;

COMMENT ON COLUMN public.profiles.dashboard_preferences IS
  'Phase 91: { cards: {hidden, order}, profileSections: {hidden, order}, privacy: {enabled, autoReblurSec} } — NULL = default layout everywhere';

-- schema.sql mirror comment:
-- dashboard_preferences JSONB DEFAULT NULL, -- supabase/profiles-dashboard-preferences.sql (Phase 91)
