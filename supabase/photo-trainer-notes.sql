-- ============================================================
-- Phase 18B: move trainer_notes to a trainer-only table
-- (Postgres has no column-level RLS; the column must leave photo_metadata)
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.photo_trainer_notes (
  photo_id UUID PRIMARY KEY REFERENCES public.photo_metadata(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  notes TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.photo_trainer_notes ENABLE ROW LEVEL SECURITY;

-- Trainers only (default deny for everyone else, incl. the photo owner)
CREATE POLICY "Trainers can read their client photo notes"
  ON public.photo_trainer_notes FOR SELECT TO authenticated
  USING (
    public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  );

CREATE POLICY "Trainers can insert their client photo notes"
  ON public.photo_trainer_notes FOR INSERT TO authenticated
  WITH CHECK (
    trainer_id = auth.uid()
    AND public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  );

CREATE POLICY "Trainers can update their client photo notes"
  ON public.photo_trainer_notes FOR UPDATE TO authenticated
  USING (
    public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  )
  WITH CHECK (
    trainer_id = auth.uid()
    AND public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  );

CREATE POLICY "Trainers can delete their client photo notes"
  ON public.photo_trainer_notes FOR DELETE TO authenticated
  USING (
    public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  );

-- Migrate any existing trainer_notes (owner_id is a profile id, so the
-- trainer is resolved via profiles -> clients on email, same as is_my_client)
INSERT INTO public.photo_trainer_notes (photo_id, trainer_id, notes)
SELECT pm.id, c.trainer_id, pm.trainer_notes
FROM public.photo_metadata pm
JOIN public.profiles p ON p.id = pm.owner_id
JOIN public.clients c ON c.email = p.email
WHERE pm.trainer_notes IS NOT NULL;

-- Drop the old column (owner view no longer needs to exclude it, but keep it)
ALTER TABLE public.photo_metadata DROP COLUMN IF EXISTS trainer_notes;
