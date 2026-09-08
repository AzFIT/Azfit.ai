-- ============================================================
-- Phase 79 Item 1: client_plan_blueprints — the "Smart Blueprint"
-- input panel (trainer captures deep client context; later phases
-- turn it into a Plan Summary). One row per client (UNIQUE).
-- Additive only. Applied live via pooler; mirrored into schema.sql;
-- src/types/supabase.ts updated. RLS mirrors the 27B pattern:
-- trainers manage their own clients' rows; clients READ their own
-- row (the panel is trainer-facing; client-side editing is a later
-- phase decision).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_plan_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  equipment_access TEXT CHECK (equipment_access IN (
    'full_gym', 'home_gym_bb_db', 'dumbbells_only', 'bodyweight_only'
  )),
  injuries_notes TEXT,
  stress_level INT CHECK (stress_level BETWEEN 1 AND 10),
  sleep_quality INT CHECK (sleep_quality BETWEEN 1 AND 10),
  dietary_restriction TEXT CHECK (dietary_restriction IN (
    'none', 'vegan', 'vegetarian', 'pescatarian', 'dairy_free', 'gluten_free'
  )),
  food_include JSONB NOT NULL DEFAULT '[]'::jsonb,
  food_exclude JSONB NOT NULL DEFAULT '[]'::jsonb,
  meal_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_plan_blueprints ENABLE ROW LEVEL SECURITY;

-- Trainers manage blueprints for their own clients (27B shape)
CREATE POLICY "Trainers can manage client plan blueprints"
  ON public.client_plan_blueprints FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid()));

-- Clients READ ONLY their own blueprint (email join identity path)
CREATE POLICY "Clients can read own plan blueprint"
  ON public.client_plan_blueprints FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  );
