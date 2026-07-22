-- ============================================================
-- Nutrition: Open Food Facts cache + per-user meal logs
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- foods_cache: normalized OFF products + custom foods
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.foods_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL DEFAULT 'off' CHECK (source IN ('off', 'custom')),
  source_id TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  serving_size_g NUMERIC DEFAULT 100,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fats NUMERIC NOT NULL DEFAULT 0,
  raw JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_id)
);

ALTER TABLE public.foods_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read foods_cache"
  ON public.foods_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert foods_cache"
  ON public.foods_cache FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ------------------------------------------------------------
-- nutrition_logs: per-user meal entries
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
  food_id UUID NOT NULL REFERENCES public.foods_cache(id),
  quantity_g NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nutrition_logs_user_date_idx
  ON public.nutrition_logs (user_id, logged_date);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own nutrition_logs"
  ON public.nutrition_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own nutrition_logs"
  ON public.nutrition_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own nutrition_logs"
  ON public.nutrition_logs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- SECURITY DEFINER helper: is a profile id one of my clients?
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_my_client(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.profiles p ON p.email = c.email
    WHERE c.trainer_id = auth.uid()
      AND p.id = p_user_id
  );
$$;

CREATE POLICY "Trainers can read client nutrition_logs"
  ON public.nutrition_logs FOR SELECT
  TO authenticated
  USING (public.is_trainer() AND public.is_my_client(user_id));
