-- ============================================================
-- Phase 89: per-user trainer navigation visibility preferences.
-- Additive nullable JSONB column on profiles (same pattern as Phase 68
-- calendar_emoji). Shape: { "hidden": ["analytics", "sheets", ...] } —
-- ids from src/lib/trainerNav.ts TRAINER_NAV_ITEMS. NULL = all items
-- visible (default). Dashboard is permanent and can never be hidden.
-- RLS: existing "Users can update own profile" policy covers writes;
-- each user reads their own row via "Users can read own profile".
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nav_preferences JSONB DEFAULT NULL;

COMMENT ON COLUMN profiles.nav_preferences IS
  'Phase 89: trainer nav visibility prefs {"hidden":["analytics",...]}; NULL = all visible; dashboard is permanent';
