-- ============================================================
-- Phase 96: Payments, Packages & Attendance (core money model)
--
-- MONEY HANDLING DECISION (documented): ALL money is integer
-- cents (INT columns, *_cents naming). JS never does float math
-- on money — src/lib/money.ts formats/parses at the boundaries.
--
-- COEXISTENCE with Phase 50 session_packages: that table is the
-- FREE/derivative credit model (no money, no counter). This phase
-- adds the PAID model: packages (bundle price + used counter +
-- expiry), client_rates (per-session rate), payments (the only
-- money ledger — displayed revenue is always SUM(payments)).
--
-- Attendance is DERIVED from existing sessions (status='completed'
-- per client_record_id) — no attendance table.
-- All DDL additive; existing rows untouched.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_rates (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  rate_cents INT NOT NULL CHECK (rate_cents > 0),
  billing_unit TEXT NOT NULL DEFAULT 'session' CHECK (billing_unit IN ('session','month')),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_sessions INT NOT NULL CHECK (total_sessions > 0),
  sessions_used INT NOT NULL DEFAULT 0 CHECK (sessions_used >= 0),
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  purchased_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (sessions_used <= total_sessions)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  package_id UUID NULL REFERENCES public.packages(id) ON DELETE SET NULL,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('package','package_session','single_session','other')),
  note TEXT,
  paid_at TIMESTAMPTZ DEFAULT now(),
  logged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_client ON public.packages(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_package ON public.payments(package_id);

ALTER TABLE public.client_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 27B pattern: trainer manages rows only for OWN clients;
-- client role read-only on their own (profiles-email join).
DROP POLICY IF EXISTS "Trainers manage own client rates" ON public.client_rates;
CREATE POLICY "Trainers manage own client rates"
  ON public.client_rates FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()));

DROP POLICY IF EXISTS "Clients read own rates" ON public.client_rates;
CREATE POLICY "Clients read own rates"
  ON public.client_rates FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.email = p.email
    )
  );

DROP POLICY IF EXISTS "Trainers manage own client packages" ON public.packages;
CREATE POLICY "Trainers manage own client packages"
  ON public.packages FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()));

DROP POLICY IF EXISTS "Clients read own packages" ON public.packages;
CREATE POLICY "Clients read own packages"
  ON public.packages FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.email = p.email
    )
  );

DROP POLICY IF EXISTS "Trainers manage own client payments" ON public.payments;
CREATE POLICY "Trainers manage own client payments"
  ON public.payments FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE trainer_id = auth.uid()));

DROP POLICY IF EXISTS "Clients read own payments" ON public.payments;
CREATE POLICY "Clients read own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.email = p.email
    )
  );
