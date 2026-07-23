-- ============================================================
-- Phase 16: client intake profile extras (goals/medical/equipment)
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================
-- Existing clients columns cover: name/email/phone/dob/gender/height/
-- weight/body_fat/fitness_goal/experience_level. The remaining wizard
-- fields (secondary goal, equipment, sessions/week, session duration,
-- emergency contact, injuries, medications, allergies, cleared-to-
-- exercise, safety checkboxes, activity level, computed TDEE targets)
-- are stored as structured JSON in ONE new column instead of a dozen
-- sparse columns. No RLS change needed (clients policies already apply).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS intake_profile JSONB;
