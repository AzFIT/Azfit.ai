-- ============================================================
-- Phase 67: daily_plan_items — the client's "My Plan for Today"
-- checklist rows. CUSTOM items persist (incl. their done flag);
-- session/target/check-in auto items are derived at render time and
-- never stored (their done state is computed from the real action).
-- Additive only. Applied live via pooler; mirrored into schema.sql;
-- src/types/supabase.ts updated. RLS mirrors the 27B pattern:
-- trainers manage their own clients' rows; clients manage ONLY their
-- own rows (profiles-email identity join).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.daily_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  label TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'custom'
    CHECK (source IN ('custom', 'session', 'target', 'checkin')),
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent adds: the same client can't insert the same label twice
-- for one day+source (double-click / retry safe).
CREATE UNIQUE INDEX IF NOT EXISTS daily_plan_items_unique
  ON public.daily_plan_items (client_id, plan_date, label, source);

ALTER TABLE public.daily_plan_items ENABLE ROW LEVEL SECURITY;

-- Trainers manage plan items for their own clients (27B shape —
-- same as "Trainers can manage client goals")
CREATE POLICY "Trainers can manage client daily plan items"
  ON public.daily_plan_items FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid()));

-- Clients manage ONLY their own rows (email join — same identity path
-- as body_composition / client_goals)
CREATE POLICY "Clients manage own daily plan items"
  ON public.daily_plan_items FOR ALL TO authenticated
  USING (
    client_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  );
