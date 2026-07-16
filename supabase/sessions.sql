-- ============================================================
-- SESSIONS TABLE (real scheduling)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '1-on-1',
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'scheduled', 'completed', 'cancelled')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_trainer_starts ON sessions(trainer_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_sessions_client_starts ON sessions(client_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Trainers: full CRUD on their own sessions
CREATE POLICY "Trainers can manage their sessions"
  ON sessions FOR ALL
  USING (trainer_id = auth.uid());

-- Clients: SELECT their own sessions
CREATE POLICY "Clients can view their sessions"
  ON sessions FOR SELECT
  USING (client_id = auth.uid());

-- Clients: INSERT with status 'requested' only
CREATE POLICY "Clients can request sessions"
  ON sessions FOR INSERT
  WITH CHECK (client_id = auth.uid() AND status = 'requested');

-- Clients: UPDATE only to cancel their own sessions
CREATE POLICY "Clients can cancel their sessions"
  ON sessions FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (status = 'cancelled');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
