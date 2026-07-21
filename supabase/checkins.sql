-- ============================================================
-- CHECK-INS & HABITS
-- ============================================================

-- ------------------------------------------------------------
-- check_in_forms: reusable forms created by trainers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS check_in_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  frequency TEXT NOT NULL DEFAULT 'weekly',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_check_in_forms_trainer ON check_in_forms(trainer_id);

-- ------------------------------------------------------------
-- check_in_submissions: client responses to a form
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS check_in_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES check_in_forms(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  trainer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_check_in_submissions_client ON check_in_submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_check_in_submissions_form ON check_in_submissions(form_id);

-- ------------------------------------------------------------
-- habits: trainer-assigned habits for clients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_frequency TEXT NOT NULL DEFAULT 'daily',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habits_client ON habits(client_id);
CREATE INDEX IF NOT EXISTS idx_habits_trainer ON habits(trainer_id);

-- ------------------------------------------------------------
-- habit_logs: daily check-off for each habit
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  done BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (habit_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_client_date ON habit_logs(client_id, log_date);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE check_in_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: current user's profile email matches the client record's email.
-- This is the same pattern as the existing "Clients can read own record" policy.
-- It does NOT subquery profiles recursively; it joins clients to the auth session identity.

-- check_in_forms: trainers manage their own; clients see forms from their trainer
CREATE POLICY "Trainers can manage their check-in forms"
  ON check_in_forms FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Clients can read their trainer's check-in forms"
  ON check_in_forms FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.trainer_id = check_in_forms.trainer_id
        AND c.email = p.email
    )
  );

-- check_in_submissions: clients submit/read their own; trainers review submissions for their forms
CREATE POLICY "Clients can create their own submissions"
  ON check_in_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.id = check_in_submissions.client_id
        AND c.email = p.email
    )
  );

CREATE POLICY "Clients can read their own submissions"
  ON check_in_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.id = check_in_submissions.client_id
        AND c.email = p.email
    )
  );

CREATE POLICY "Trainers can review submissions for their forms"
  ON check_in_submissions FOR SELECT
  USING (
    form_id IN (
      SELECT id FROM check_in_forms WHERE trainer_id = auth.uid()
    )
  );

CREATE POLICY "Trainers can update submission review fields"
  ON check_in_submissions FOR UPDATE
  USING (
    form_id IN (
      SELECT id FROM check_in_forms WHERE trainer_id = auth.uid()
    )
  )
  WITH CHECK (
    form_id IN (
      SELECT id FROM check_in_forms WHERE trainer_id = auth.uid()
    )
  );

-- habits: trainers manage; clients see their assigned habits
CREATE POLICY "Trainers can manage their habits"
  ON habits FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Clients can read their assigned habits"
  ON habits FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.id = habits.client_id
        AND c.email = p.email
    )
  );

-- habit_logs: clients log their own; trainers read logs for their habits
CREATE POLICY "Clients can log their own habits"
  ON habit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.id = habit_logs.client_id
        AND c.email = p.email
    )
  );

CREATE POLICY "Clients can read their own habit logs"
  ON habit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.id = habit_logs.client_id
        AND c.email = p.email
    )
  );

CREATE POLICY "Clients can update their own habit logs"
  ON habit_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.id = habit_logs.client_id
        AND c.email = p.email
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.id = habit_logs.client_id
        AND c.email = p.email
    )
  );

CREATE POLICY "Trainers can read logs for their habits"
  ON habit_logs FOR SELECT
  USING (
    habit_id IN (
      SELECT id FROM habits WHERE trainer_id = auth.uid()
    )
  );
