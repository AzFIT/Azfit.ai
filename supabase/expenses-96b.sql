-- Phase 96b — Money dashboard: expenses + net profit.
-- Additive only. Owner-only RLS (27B trainer-scoped by auth.uid());
-- client role has NO policies on expenses (default deny) — clients never
-- see trainer business costs.

BEGIN;

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  expense_date DATE NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_trainer_date ON public.expenses(trainer_id, expense_date);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainers manage own expenses" ON public.expenses;
CREATE POLICY "Trainers manage own expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

COMMIT;
