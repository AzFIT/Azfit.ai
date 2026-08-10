-- ============================================================
-- Plan Summaries (Blueprint reports) — Phase 61
-- Client-facing plan summary documents generated from client stats.
-- RLS mirrors the 27B client_goals pattern: trainers manage rows
-- for their clients; a client can read their own summaries.
-- Applied live via pooler; mirror appended to schema.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plan_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL,
  inputs jsonb NOT NULL,
  result jsonb NOT NULL,
  recommended_style text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.plan_summaries ENABLE ROW LEVEL SECURITY;

-- Trainers manage summaries for their own clients (27B pattern)
CREATE POLICY "Trainers can manage plan summaries"
  ON public.plan_summaries FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid()));

-- Clients read their own summaries (email join, 27B pattern)
CREATE POLICY "Clients can read own plan summaries"
  ON public.plan_summaries FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  );
