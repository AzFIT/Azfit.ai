-- ============================================================
-- Phase 27E: meal plans (auto-generated day plans per client)
-- v1: ONE active plan per client (new generate overwrites after
-- confirm); items stored as jsonb — no meal_plan_items table.
-- Keys on clients(id) like client_goals — account-less clients work.
-- RLS copied from client_goals: trainer ALL own clients + client
-- SELECT own.
-- Applied live via pooler; mirror appended to schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Daily Meal Plan',
  targets JSONB,
  items JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage meal plans"
  ON public.meal_plans FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid()));

CREATE POLICY "Clients can read own meal plans"
  ON public.meal_plans FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  );
