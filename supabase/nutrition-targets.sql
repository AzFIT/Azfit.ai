-- ============================================================
-- Phase 15B: nutrition_targets table + trainer-start-workout policies
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- nutrition_targets: per-user macro targets (client-editable,
-- trainer-editable for their clients)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_targets (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  calories INT,
  protein_g INT,
  carbs_g INT,
  fats_g INT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own targets"
  ON public.nutrition_targets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own targets"
  ON public.nutrition_targets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own targets"
  ON public.nutrition_targets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Trainers can read client targets"
  ON public.nutrition_targets FOR SELECT
  TO authenticated
  USING (public.is_trainer() AND public.is_my_client(user_id));

CREATE POLICY "Trainers can update client targets"
  ON public.nutrition_targets FOR UPDATE
  TO authenticated
  USING (public.is_trainer() AND public.is_my_client(user_id))
  WITH CHECK (public.is_trainer() AND public.is_my_client(user_id));

-- ------------------------------------------------------------
-- Trainer "Start Workout" for a client (clients.id based)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_my_client_id(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = p_client_id AND trainer_id = auth.uid()
  );
$$;

CREATE POLICY "Trainers can create logs for clients"
  ON public.workout_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_my_client_id(client_id));

CREATE POLICY "Trainers can create log entries for clients"
  ON public.workout_log_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.is_my_client_id(client_id));
