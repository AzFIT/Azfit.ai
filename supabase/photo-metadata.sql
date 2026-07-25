-- ============================================================
-- Phase 18: progress photo metadata (categories, weight/BF,
-- notes, trainer-private annotations, milestones)
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.photo_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_path TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN ('Front', 'Back', 'Side', 'Other')) DEFAULT 'Other',
  taken_on DATE DEFAULT CURRENT_DATE,
  weight_kg NUMERIC,
  body_fat_pct NUMERIC,
  notes TEXT,
  trainer_notes TEXT,
  is_milestone BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.photo_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own photo_metadata"
  ON public.photo_metadata FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own photo_metadata"
  ON public.photo_metadata FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own photo_metadata"
  ON public.photo_metadata FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own photo_metadata"
  ON public.photo_metadata FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Trainers can read client photo_metadata"
  ON public.photo_metadata FOR SELECT TO authenticated
  USING (public.is_trainer() AND public.is_my_client(owner_id));

CREATE POLICY "Trainers can update client photo_metadata"
  ON public.photo_metadata FOR UPDATE TO authenticated
  USING (public.is_trainer() AND public.is_my_client(owner_id))
  WITH CHECK (public.is_trainer() AND public.is_my_client(owner_id));

-- Owner-facing view WITHOUT trainer_notes (security_invoker so the
-- owner's own-row RLS applies; clients query this, trainers the table)
CREATE OR REPLACE VIEW public.photo_metadata_owner
WITH (security_invoker = true) AS
SELECT
  id,
  storage_path,
  owner_id,
  category,
  taken_on,
  weight_kg,
  body_fat_pct,
  notes,
  is_milestone,
  created_at
FROM public.photo_metadata;

-- Trainers can read client photo objects from storage (folder owner is a client)
CREATE POLICY "Trainers can read client progress photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND public.is_my_client((storage.foldername(name))[1]::uuid)
  );
