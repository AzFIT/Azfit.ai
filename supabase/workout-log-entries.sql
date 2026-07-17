-- ============================================================
-- WORKOUT LOG ENTRIES TABLE
-- Extracted from supabase/schema.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_log_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  sets_completed INTEGER NOT NULL DEFAULT 0,
  total_sets INTEGER NOT NULL DEFAULT 0,
  reps_per_set INTEGER[] DEFAULT '{}',
  weight_per_set NUMERIC(6,2)[] DEFAULT '{}',
  rpe_per_set NUMERIC(3,1)[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_log_entries_workout_log ON workout_log_entries(workout_log_id);
CREATE INDEX IF NOT EXISTS idx_workout_log_entries_client ON workout_log_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_log_entries_exercise ON workout_log_entries(exercise_id);

ALTER TABLE workout_log_entries ENABLE ROW LEVEL SECURITY;

-- WORKOUT LOG ENTRIES
CREATE POLICY "Clients can create their log entries"
  ON workout_log_entries FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE email = (
        SELECT email FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Clients can read their log entries"
  ON workout_log_entries FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = (
        SELECT email FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Trainers can read client log entries"
  ON workout_log_entries FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE trainer_id = auth.uid()
    )
  );
