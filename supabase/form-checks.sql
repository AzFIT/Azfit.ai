-- ============================================================
-- Phase 19: form-check videos (client upload + trainer review)
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.form_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT UNIQUE NOT NULL,
  exercise_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  feedback TEXT,
  positives TEXT,
  improvements TEXT,
  timestamp_notes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.form_checks ENABLE ROW LEVEL SECURITY;

-- Owner: read/insert/delete own; update own only while still pending
CREATE POLICY "Users can select own form_checks"
  ON public.form_checks FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own form_checks"
  ON public.form_checks FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own form_checks"
  ON public.form_checks FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can update own pending form_checks"
  ON public.form_checks FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND status = 'pending')
  WITH CHECK (owner_id = auth.uid() AND status = 'pending');

-- Trainer: read + update their clients' submissions
CREATE POLICY "Trainers can read client form_checks"
  ON public.form_checks FOR SELECT TO authenticated
  USING (public.is_trainer() AND public.is_my_client(owner_id));

CREATE POLICY "Trainers can update client form_checks"
  ON public.form_checks FOR UPDATE TO authenticated
  USING (public.is_trainer() AND public.is_my_client(owner_id))
  WITH CHECK (public.is_trainer() AND public.is_my_client(owner_id));

-- ── Storage bucket (private) + policies ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-checks', 'form-checks', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "form-checks_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'form-checks' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "form-checks_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form-checks' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "form-checks_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'form-checks' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "form-checks_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'form-checks' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "form-checks_trainer_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'form-checks'
    AND public.is_my_client((storage.foldername(name))[1]::uuid)
  );
