-- Phase 74 Item 4: exercise library dedup FOLLOW-UP — one pair
-- EX0632 → EX0630 ("Machine Chest Supported Row"), a collision added after
-- the Phase 52B report's 628-row snapshot (flagged in the Phase 72 run).
-- Same pattern as supabase/dedup-exercises.sql: one transaction, guarded and
-- idempotent (a second run is a no-op). Referencing tables (re-verified via
-- pg_constraint, unchanged): exercise_library_muscles / exercise_library_equipment
-- (composite-PK junctions, ON DELETE CASCADE) + trial_assessment_items.
BEGIN;

DO $$
DECLARE
  keep_id uuid;
  absorb_id uuid;
BEGIN
  SELECT id INTO keep_id FROM public.exercise_library WHERE code = 'EX0630';
  SELECT id INTO absorb_id FROM public.exercise_library WHERE code = 'EX0632';
  IF keep_id IS NULL OR absorb_id IS NULL THEN
    RAISE NOTICE 'dedup74: SKIP EX0630/EX0632 (row missing — already merged or renamed)';
    RETURN;
  END IF;

  -- (a) metadata merge: fill NULL/empty keep content columns from absorb; never overwrite
  UPDATE public.exercise_library k
  SET
    primary_muscle   = COALESCE(NULLIF(k.primary_muscle, ''), a.primary_muscle),
    secondary_muscle = COALESCE(NULLIF(k.secondary_muscle, ''), a.secondary_muscle),
    equipment        = COALESCE(NULLIF(k.equipment, ''), a.equipment),
    difficulty       = COALESCE(k.difficulty, a.difficulty),
    exercise_type    = COALESCE(NULLIF(k.exercise_type, ''), a.exercise_type),
    type             = COALESCE(NULLIF(k.type, ''), a.type),
    met_value        = COALESCE(k.met_value, a.met_value),
    description      = COALESCE(NULLIF(k.description, ''), a.description),
    safety_notes     = COALESCE(NULLIF(k.safety_notes, ''), a.safety_notes),
    youtube_url      = COALESCE(NULLIF(k.youtube_url, ''), a.youtube_url),
    image_url        = COALESCE(NULLIF(k.image_url, ''), a.image_url),
    updated_at       = now()
  FROM public.exercise_library a
  WHERE k.id = keep_id AND a.id = absorb_id;

  -- (b) junction merge: unique absorb tags survive (composite PKs dedupe)
  INSERT INTO public.exercise_library_muscles (exercise_library_id, muscle_name, is_primary)
  SELECT keep_id, m.muscle_name, m.is_primary
  FROM public.exercise_library_muscles m
  WHERE m.exercise_library_id = absorb_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.exercise_library_equipment (exercise_library_id, equipment_type_id)
  SELECT keep_id, e.equipment_type_id
  FROM public.exercise_library_equipment e
  WHERE e.exercise_library_id = absorb_id
  ON CONFLICT DO NOTHING;

  -- (c) repoint non-junction FK references
  UPDATE public.trial_assessment_items
  SET exercise_library_id = keep_id
  WHERE exercise_library_id = absorb_id;

  -- (d) delete absorb row (its remaining junction rows cascade)
  DELETE FROM public.exercise_library WHERE id = absorb_id;
  RAISE NOTICE 'dedup74: merged EX0632 -> EX0630 (machine chest supported row)';
END $$;

COMMIT;
