-- ============================================================
-- Phase 53: trial-client fast intake + trial assessment.
-- 1) clients.equipment_access text[] — first-class multi-equipment
--    storage (intake_profile.equipment jsonb mirror kept for the
--    26C intake card; column is canonical going forward).
-- 2) trial_assessments + trial_assessment_items — structured trial
--    session records. RLS mirrors the 27B client_goals pattern:
--    trainers manage rows for their clients, clients read own.
-- Applied live via pooler; mirror appended to schema.sql.
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS equipment_access text[] NULL;

CREATE TABLE IF NOT EXISTS public.trial_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_record_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Trial Assessment',
  assessed_on date NOT NULL DEFAULT CURRENT_DATE,
  general_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trial_assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES trial_assessments(id) ON DELETE CASCADE,
  exercise_library_id uuid REFERENCES exercise_library(id),
  exercise_name text NOT NULL,
  equipment text,
  sets integer,
  reps text,
  tempo text,
  verdict text CHECK (verdict IN ('can_do','needs_modification','cannot_do')),
  notes text,
  order_index integer DEFAULT 0
);

ALTER TABLE public.trial_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_assessment_items ENABLE ROW LEVEL SECURITY;

-- Trainers manage assessments for their own clients (27B pattern)
CREATE POLICY "Trainers can manage trial assessments"
  ON public.trial_assessments FOR ALL TO authenticated
  USING (client_record_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid()));

-- Clients read their own assessments (email join, 27B pattern)
CREATE POLICY "Clients can read own trial assessments"
  ON public.trial_assessments FOR SELECT TO authenticated
  USING (
    client_record_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  );

-- Items inherit access through their parent assessment
CREATE POLICY "Trainers can manage trial assessment items"
  ON public.trial_assessment_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trial_assessments a
      WHERE a.id = assessment_id AND a.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Clients can read own trial assessment items"
  ON public.trial_assessment_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trial_assessments a
      JOIN clients c ON c.id = a.client_record_id
      WHERE a.id = assessment_id
        AND c.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  );
