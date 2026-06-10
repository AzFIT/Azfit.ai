-- ============================================================
-- AzFIT AI - Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('trainer', 'client')) DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENTS TABLE (managed by trainers)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  height_cm NUMERIC(5,2),
  weight_kg NUMERIC(5,2),
  body_fat_percentage NUMERIC(5,2),
  fitness_goal TEXT,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'on_hold')) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROGRAMS TABLE (workout programs)
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_weeks INTEGER DEFAULT 4,
  frequency_per_week INTEGER DEFAULT 3,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'archived')) DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORKOUTS TABLE (individual workouts within a program)
-- ============================================================
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
  week_number INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXERCISES TABLE (exercises within a workout)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER DEFAULT 3,
  reps TEXT DEFAULT '8-12',
  weight_kg NUMERIC(6,2),
  rest_seconds INTEGER DEFAULT 60,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORKOUT LOGS TABLE (completed workouts by clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BODY COMPOSITION TABLE (tracking measurements)
-- ============================================================
CREATE TABLE IF NOT EXISTS body_composition (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  weight_kg NUMERIC(5,2),
  body_fat_percentage NUMERIC(5,2),
  muscle_mass_kg NUMERIC(5,2),
  bmi NUMERIC(4,2),
  chest_cm NUMERIC(5,2),
  waist_cm NUMERIC(5,2),
  hips_cm NUMERIC(5,2),
  arms_cm NUMERIC(5,2),
  thighs_cm NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES TABLE (trainer-client messaging)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_trainer ON clients(trainer_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_programs_trainer ON programs(trainer_id);
CREATE INDEX IF NOT EXISTS idx_programs_client ON programs(client_id);
CREATE INDEX IF NOT EXISTS idx_workouts_program ON workouts(program_id);
CREATE INDEX IF NOT EXISTS idx_exercises_workout ON exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_client ON workout_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_body_composition_client ON body_composition(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_composition ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can read their own profile, trainers can read all
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trainers can read all profiles
CREATE POLICY "Trainers can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'
    )
  );

-- CLIENTS: Trainers can manage their clients, clients can read their own
CREATE POLICY "Trainers can manage their clients"
  ON clients FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Clients can read own record"
  ON clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND email = clients.email
    )
  );

-- PROGRAMS: Trainers can manage their programs, clients can read assigned
CREATE POLICY "Trainers can manage their programs"
  ON programs FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Clients can read assigned programs"
  ON programs FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = (
        SELECT email FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- WORKOUTS: Same as programs
CREATE POLICY "Trainers can manage workouts"
  ON workouts FOR ALL
  USING (
    program_id IN (
      SELECT id FROM programs WHERE trainer_id = auth.uid()
    )
  );

CREATE POLICY "Clients can read assigned workouts"
  ON workouts FOR SELECT
  USING (
    program_id IN (
      SELECT id FROM programs WHERE client_id IN (
        SELECT id FROM clients WHERE email = (
          SELECT email FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- EXERCISES: Same pattern
CREATE POLICY "Trainers can manage exercises"
  ON exercises FOR ALL
  USING (
    workout_id IN (
      SELECT id FROM workouts WHERE program_id IN (
        SELECT id FROM programs WHERE trainer_id = auth.uid()
      )
    )
  );

CREATE POLICY "Clients can read exercises"
  ON exercises FOR SELECT
  USING (
    workout_id IN (
      SELECT id FROM workouts WHERE program_id IN (
        SELECT id FROM programs WHERE client_id IN (
          SELECT id FROM clients WHERE email = (
            SELECT email FROM profiles WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- WORKOUT LOGS
CREATE POLICY "Clients can create their logs"
  ON workout_logs FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE email = (
        SELECT email FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Clients can read their logs"
  ON workout_logs FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = (
        SELECT email FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Trainers can read client logs"
  ON workout_logs FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE trainer_id = auth.uid()
    )
  );

-- BODY COMPOSITION
CREATE POLICY "Trainers can manage body composition"
  ON body_composition FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients WHERE trainer_id = auth.uid()
    )
  );

CREATE POLICY "Clients can read own body composition"
  ON body_composition FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = (
        SELECT email FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- MESSAGES
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can read their messages"
  ON messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can update read status"
  ON messages FOR UPDATE
  USING (receiver_id = auth.uid());

-- ============================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTION: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DONE! Your AzFIT database is ready.
-- ============================================================
