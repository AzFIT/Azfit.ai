-- ============================================================
-- SKINFOLD ASSESSMENTS TABLE (caliper / BioPrint)
-- ============================================================
CREATE TABLE IF NOT EXISTS skinfold_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  protocol TEXT NOT NULL CHECK (protocol IN ('jp3', 'jp7', 'poliquin12')),
  sites JSONB NOT NULL DEFAULT '{}',
  sum_mm NUMERIC(6, 2),
  body_fat_pct NUMERIC(5, 2),
  weight_kg NUMERIC(5, 2),
  age_years INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skinfold_assessments_client ON skinfold_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_skinfold_assessments_recorded_at ON skinfold_assessments(recorded_at DESC);

ALTER TABLE skinfold_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage skinfold assessments"
  ON skinfold_assessments FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients WHERE trainer_id = auth.uid()
    )
  );

CREATE POLICY "Clients can read own skinfold assessments"
  ON skinfold_assessments FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = (
        SELECT email FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Clients can log own skinfold assessments"
  ON skinfold_assessments FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE email = (
        SELECT email FROM profiles WHERE id = auth.uid()
      )
    )
  );
