-- ============================================================
-- Phase 27B: client goals (what the client is working toward)
-- Keys on clients(id) like body_composition — works for
-- account-less clients. RLS mirrors the body_composition pattern:
-- trainer ALL for own clients, client SELECT own.
-- NOTE: the existing "goals" table is the program-library
-- taxonomy (wizard Step 1) — untouched.
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN (
    'lose_weight','build_muscle','reduce_body_fat',
    'increase_strength','improve_fitness','custom'
  )),
  custom_label TEXT,
  target_weight_kg NUMERIC,
  target_body_fat_pct NUMERIC,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE,
  is_achieved BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT client_goals_custom_label_required
    CHECK (goal_type <> 'custom' OR (custom_label IS NOT NULL AND btrim(custom_label) <> ''))
);

ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;

-- Trainers manage goals for their own clients (same shape as
-- "Trainers can manage body composition")
CREATE POLICY "Trainers can manage client goals"
  ON public.client_goals FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid()));

-- Clients read their own goals (email join, same as body_composition)
CREATE POLICY "Clients can read own goals"
  ON public.client_goals FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  );
