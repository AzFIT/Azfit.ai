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
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'on_hold', 'archived')) DEFAULT 'active',
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
  phase_name TEXT, -- Phase 26E: editable phase label (cards fall back to "Program Phase")
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
-- WORKOUT LOG ENTRIES TABLE (per-exercise details within a workout log)
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
CREATE INDEX IF NOT EXISTS idx_workout_log_entries_workout_log ON workout_log_entries(workout_log_id);
CREATE INDEX IF NOT EXISTS idx_workout_log_entries_client ON workout_log_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_log_entries_exercise ON workout_log_entries(exercise_id);
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
ALTER TABLE workout_log_entries ENABLE ROW LEVEL SECURITY;
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
CREATE OR REPLACE FUNCTION public.is_trainer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer');
$$;

CREATE POLICY "Trainers can read all profiles"
  ON profiles FOR SELECT
  USING (public.is_trainer());

CREATE OR REPLACE FUNCTION public.my_trainer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trainer_id FROM public.clients WHERE email = auth.email() LIMIT 1;
$$;

CREATE POLICY "Clients can read their trainer's profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = public.my_trainer_id());

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

CREATE POLICY "Clients can insert own body composition"
  ON body_composition FOR INSERT
  WITH CHECK (
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
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'general',
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

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

-- ============================================================
-- AI Chat Tables (Stage 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.faq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  roles text[] NOT NULL DEFAULT '{trainer,client}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  intent text,
  tokens_input int,
  tokens_output int,
  model_used text,
  latency_ms int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating int NOT NULL CHECK (rating IN (-1, 1)),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx ON public.chat_messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_events_user_type_idx ON public.chat_events (user_id, event_type);
CREATE INDEX IF NOT EXISTS faq_entries_keywords_idx ON public.faq_entries USING gin (keywords);

ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FAQ read authenticated"
  ON public.faq_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users insert own messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users select own messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own events"
  ON public.chat_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users select own events"
  ON public.chat_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own feedback"
  ON public.chat_feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users select own feedback"
  ON public.chat_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- NUTRITION: foods cache + meal logs (Phase 15)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.foods_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL DEFAULT 'off' CHECK (source IN ('off', 'custom')),
  source_id TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  serving_size_g NUMERIC DEFAULT 100,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fats NUMERIC NOT NULL DEFAULT 0,
  raw JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_id)
);

ALTER TABLE public.foods_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read foods_cache"
  ON public.foods_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert foods_cache"
  ON public.foods_cache FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
  food_id UUID NOT NULL REFERENCES public.foods_cache(id),
  quantity_g NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nutrition_logs_user_date_idx
  ON public.nutrition_logs (user_id, logged_date);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own nutrition_logs"
  ON public.nutrition_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own nutrition_logs"
  ON public.nutrition_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own nutrition_logs"
  ON public.nutrition_logs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_my_client(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.profiles p ON p.email = c.email
    WHERE c.trainer_id = auth.uid()
      AND p.id = p_user_id
  );
$$;

CREATE POLICY "Trainers can read client nutrition_logs"
  ON public.nutrition_logs FOR SELECT
  TO authenticated
  USING (public.is_trainer() AND public.is_my_client(user_id));

-- ============================================================
-- NUTRITION TARGETS + trainer-start-workout policies (Phase 15B)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrition_targets (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  calories INT,
  protein_g INT,
  carbs_g INT,
  fats_g INT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own targets"
  ON public.nutrition_targets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own targets"
  ON public.nutrition_targets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own targets"
  ON public.nutrition_targets FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Trainers can read client targets"
  ON public.nutrition_targets FOR SELECT TO authenticated
  USING (public.is_trainer() AND public.is_my_client(user_id));

CREATE POLICY "Trainers can update client targets"
  ON public.nutrition_targets FOR UPDATE TO authenticated
  USING (public.is_trainer() AND public.is_my_client(user_id))
  WITH CHECK (public.is_trainer() AND public.is_my_client(user_id));

CREATE OR REPLACE FUNCTION public.is_my_client_id(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = p_client_id AND trainer_id = auth.uid()
  );
$$;

CREATE POLICY "Trainers can create logs for clients"
  ON public.workout_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_my_client_id(client_id));

CREATE POLICY "Trainers can create log entries for clients"
  ON public.workout_log_entries FOR INSERT TO authenticated
  WITH CHECK (public.is_my_client_id(client_id));

-- ============================================================
-- CLIENT INTAKE PROFILE EXTRAS (Phase 16)
-- ============================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS intake_profile JSONB;

-- ============================================================
-- PHOTO METADATA + trainer storage read (Phase 18)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.photo_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_path TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN ('Front', 'Back', 'Side', 'Other')) DEFAULT 'Other',
  taken_on DATE DEFAULT CURRENT_DATE,
  weight_kg NUMERIC,
  body_fat_pct NUMERIC,
  notes TEXT,
  trainer_notes TEXT,
  is_milestone BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.photo_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own photo_metadata"
  ON public.photo_metadata FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own photo_metadata"
  ON public.photo_metadata FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own photo_metadata"
  ON public.photo_metadata FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own photo_metadata"
  ON public.photo_metadata FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Trainers can read client photo_metadata"
  ON public.photo_metadata FOR SELECT TO authenticated
  USING (public.is_trainer() AND public.is_my_client(owner_id));

CREATE POLICY "Trainers can update client photo_metadata"
  ON public.photo_metadata FOR UPDATE TO authenticated
  USING (public.is_trainer() AND public.is_my_client(owner_id))
  WITH CHECK (public.is_trainer() AND public.is_my_client(owner_id));

CREATE OR REPLACE VIEW public.photo_metadata_owner
WITH (security_invoker = true) AS
SELECT id, storage_path, owner_id, category, taken_on, weight_kg,
       body_fat_pct, notes, is_milestone, created_at
FROM public.photo_metadata;

CREATE POLICY "Trainers can read client progress photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND public.is_my_client((storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- PHOTO TRAINER NOTES: trainer-only annotations (Phase 18B)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.photo_trainer_notes (
  photo_id UUID PRIMARY KEY REFERENCES public.photo_metadata(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  notes TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.photo_trainer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can read their client photo notes"
  ON public.photo_trainer_notes FOR SELECT TO authenticated
  USING (
    public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  );

CREATE POLICY "Trainers can insert their client photo notes"
  ON public.photo_trainer_notes FOR INSERT TO authenticated
  WITH CHECK (
    trainer_id = auth.uid()
    AND public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  );

CREATE POLICY "Trainers can update their client photo notes"
  ON public.photo_trainer_notes FOR UPDATE TO authenticated
  USING (
    public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  )
  WITH CHECK (
    trainer_id = auth.uid()
    AND public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  );

CREATE POLICY "Trainers can delete their client photo notes"
  ON public.photo_trainer_notes FOR DELETE TO authenticated
  USING (
    public.is_trainer() AND EXISTS (
      SELECT 1 FROM public.photo_metadata pm
      WHERE pm.id = photo_id AND public.is_my_client(pm.owner_id)
    )
  );

-- photo_metadata.trainer_notes was migrated here and the column dropped.

-- ============================================================
-- FORM CHECKS: client exercise videos + trainer review (Phase 19)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.form_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT UNIQUE NOT NULL,
  exercise_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  feedback TEXT,
  positives TEXT,
  improvements TEXT,
  timestamp_notes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.form_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own form_checks"
  ON public.form_checks FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own form_checks"
  ON public.form_checks FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own form_checks"
  ON public.form_checks FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can update own pending form_checks"
  ON public.form_checks FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND status = 'pending')
  WITH CHECK (owner_id = auth.uid() AND status = 'pending');

CREATE POLICY "Trainers can read client form_checks"
  ON public.form_checks FOR SELECT TO authenticated
  USING (public.is_trainer() AND public.is_my_client(owner_id));

CREATE POLICY "Trainers can update client form_checks"
  ON public.form_checks FOR UPDATE TO authenticated
  USING (public.is_trainer() AND public.is_my_client(owner_id))
  WITH CHECK (public.is_trainer() AND public.is_my_client(owner_id));

INSERT INTO storage.buckets (id, name, public)
VALUES ('form-checks', 'form-checks', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "form-checks_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'form-checks' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "form-checks_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form-checks' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "form-checks_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'form-checks' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "form-checks_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'form-checks' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "form-checks_trainer_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'form-checks'
    AND public.is_my_client((storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- SESSIONS TABLE (real scheduling) — copied from sessions.sql
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

-- ============================================================
-- PROGRAM LIBRARY SCHEMA — copied from program-library-schema.sql
-- ============================================================
-- ============================================================
-- Program Library Schema Dump
-- Generated from live database
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: goals
-- ============================================================
CREATE TABLE IF NOT EXISTS "goals" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "step_number" integer DEFAULT 1 NOT NULL,
  "step_name" text DEFAULT 'Goal'::text NOT NULL,
  "category" goal_category DEFAULT 'General Fitness & Body Composition'::goal_category NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "icon_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "category_id" integer,
  "tags" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX goals_slug_key ON public.goals USING btree (slug);
CREATE INDEX idx_goals_category ON public.goals USING btree (category);
CREATE INDEX idx_goals_active ON public.goals USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_goals_display_order ON public.goals USING btree (display_order);

ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read goals"
  ON "goals" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage goals"
  ON "goals" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: methods
-- ============================================================
CREATE TABLE IF NOT EXISTS "methods" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "step_number" integer DEFAULT 2 NOT NULL,
  "step_name" text DEFAULT 'Method'::text NOT NULL,
  "category" method_category DEFAULT 'Classic Strength Protocols'::method_category NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "icon_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "category_id" integer,
  "tags" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX methods_slug_key ON public.methods USING btree (slug);
CREATE INDEX idx_methods_category ON public.methods USING btree (category);
CREATE INDEX idx_methods_active ON public.methods USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_methods_display_order ON public.methods USING btree (display_order);

ALTER TABLE "methods" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read methods"
  ON "methods" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage methods"
  ON "methods" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: goal_method_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS "goal_method_scores" (
  "goal_id" uuid NOT NULL,
  "method_id" uuid NOT NULL,
  "overlap_count" integer DEFAULT 0 NOT NULL,
  "jaccard_index" numeric(5,4) DEFAULT 0 NOT NULL,
  "score" numeric(5,2) DEFAULT 0 NOT NULL,
  "shared_tag_ids" integer[] DEFAULT '{}'::integer[],
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("goal_id", "method_id"),
  CONSTRAINT "goal_method_scores_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE,
  CONSTRAINT "goal_method_scores_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "methods"("id") ON DELETE CASCADE
);

CREATE INDEX idx_gm_scores_goal ON public.goal_method_scores USING btree (goal_id);
CREATE INDEX idx_gm_scores_method ON public.goal_method_scores USING btree (method_id);
CREATE INDEX idx_gm_scores_score ON public.goal_method_scores USING btree (score DESC);

ALTER TABLE "goal_method_scores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read goal_method_scores"
  ON "goal_method_scores" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: program_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS "program_templates" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "step_number" integer DEFAULT 3 NOT NULL,
  "step_name" text DEFAULT 'Program'::text NOT NULL,
  "category" program_category DEFAULT 'Foundational Programs'::program_category NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "duration_weeks" integer,
  "sessions_per_week" integer,
  "icon_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "category_id" integer,
  "tags" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX program_templates_slug_key ON public.program_templates USING btree (slug);
CREATE INDEX idx_program_templates_category ON public.program_templates USING btree (category);
CREATE INDEX idx_program_templates_active ON public.program_templates USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_program_templates_display_order ON public.program_templates USING btree (display_order);

ALTER TABLE "program_templates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read program_templates"
  ON "program_templates" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage program_templates"
  ON "program_templates" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: exercise_library
-- ============================================================
CREATE TABLE IF NOT EXISTS "exercise_library" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "code" text,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "primary_muscle" text NOT NULL,
  "secondary_muscle" text,
  "equipment" text NOT NULL,
  "difficulty" difficulty_level NOT NULL,
  "exercise_type" text NOT NULL,
  "met_value" numeric(4,2),
  "description" text,
  "safety_notes" text,
  "youtube_url" text,
  "image_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "exercise_code" text,
  "type" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX exercise_library_code_key ON public.exercise_library USING btree (code);
CREATE UNIQUE INDEX exercise_library_slug_key ON public.exercise_library USING btree (slug);
CREATE INDEX idx_exercise_library_primary_muscle ON public.exercise_library USING btree (primary_muscle);
CREATE INDEX idx_exercise_library_equipment ON public.exercise_library USING btree (equipment);
CREATE INDEX idx_exercise_library_difficulty ON public.exercise_library USING btree (difficulty);
CREATE INDEX idx_exercise_library_active ON public.exercise_library USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_exercise_library_name_trgm ON public.exercise_library USING gin (name gin_trgm_ops);
CREATE UNIQUE INDEX exercise_library_exercise_code_key ON public.exercise_library USING btree (exercise_code);

ALTER TABLE "exercise_library" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read exercise_library"
  ON "exercise_library" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage exercise_library"
  ON "exercise_library" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: exercise_library_equipment
-- ============================================================
CREATE TABLE IF NOT EXISTS "exercise_library_equipment" (
  "exercise_library_id" uuid NOT NULL,
  "equipment_type_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("exercise_library_id", "equipment_type_id"),
  CONSTRAINT "exercise_library_equipment_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE CASCADE,
  CONSTRAINT "exercise_library_equipment_exercise_library_id_fkey" FOREIGN KEY ("exercise_library_id") REFERENCES "exercise_library"("id") ON DELETE CASCADE
);


ALTER TABLE "exercise_library_equipment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read exercise_library_equipment"
  ON "exercise_library_equipment" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: exercise_library_muscles
-- ============================================================
CREATE TABLE IF NOT EXISTS "exercise_library_muscles" (
  "exercise_library_id" uuid NOT NULL,
  "muscle_name" text NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("exercise_library_id", "muscle_name"),
  CONSTRAINT "exercise_library_muscles_exercise_library_id_fkey" FOREIGN KEY ("exercise_library_id") REFERENCES "exercise_library"("id") ON DELETE CASCADE
);


ALTER TABLE "exercise_library_muscles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read exercise_library_muscles"
  ON "exercise_library_muscles" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: tags
-- ============================================================
CREATE TABLE IF NOT EXISTS "tags" (
  "id" integer DEFAULT nextval('tags_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "slug" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX tags_name_key ON public.tags USING btree (name);
CREATE INDEX idx_tags_name ON public.tags USING btree (name);

ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tags"
  ON "tags" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage tags"
  ON "tags" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: goal_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS "goal_tags" (
  "goal_id" uuid NOT NULL,
  "tag_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("goal_id", "tag_id"),
  CONSTRAINT "goal_tags_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE,
  CONSTRAINT "goal_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE INDEX idx_goal_tags_tag ON public.goal_tags USING btree (tag_id);

ALTER TABLE "goal_tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read goal_tags"
  ON "goal_tags" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: method_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS "method_tags" (
  "method_id" uuid NOT NULL,
  "tag_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("method_id", "tag_id"),
  CONSTRAINT "method_tags_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "methods"("id") ON DELETE CASCADE,
  CONSTRAINT "method_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE INDEX idx_method_tags_tag ON public.method_tags USING btree (tag_id);

ALTER TABLE "method_tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read method_tags"
  ON "method_tags" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: program_template_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS "program_template_tags" (
  "program_template_id" uuid NOT NULL,
  "tag_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("program_template_id", "tag_id"),
  CONSTRAINT "program_template_tags_program_template_id_fkey" FOREIGN KEY ("program_template_id") REFERENCES "program_templates"("id") ON DELETE CASCADE,
  CONSTRAINT "program_template_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE INDEX idx_program_template_tags_tag ON public.program_template_tags USING btree (tag_id);

ALTER TABLE "program_template_tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read program_template_tags"
  ON "program_template_tags" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: goal_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS "goal_categories" (
  "id" integer DEFAULT nextval('goal_categories_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "slug" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX goal_categories_name_key ON public.goal_categories USING btree (name);
CREATE UNIQUE INDEX goal_categories_slug_key ON public.goal_categories USING btree (slug);

ALTER TABLE "goal_categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read goal_categories"
  ON "goal_categories" FOR SELECT
  TO {public}
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Trainers can manage goal_categories"
  ON "goal_categories" FOR ALL
  TO {public}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: method_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS "method_categories" (
  "id" integer DEFAULT nextval('method_categories_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "slug" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX method_categories_name_key ON public.method_categories USING btree (name);
CREATE UNIQUE INDEX method_categories_slug_key ON public.method_categories USING btree (slug);

ALTER TABLE "method_categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read method_categories"
  ON "method_categories" FOR SELECT
  TO {public}
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Trainers can manage method_categories"
  ON "method_categories" FOR ALL
  TO {public}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: program_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS "program_categories" (
  "id" integer DEFAULT nextval('program_categories_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "slug" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX program_categories_name_key ON public.program_categories USING btree (name);
CREATE UNIQUE INDEX program_categories_slug_key ON public.program_categories USING btree (slug);

ALTER TABLE "program_categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read program_categories"
  ON "program_categories" FOR SELECT
  TO {public}
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Trainers can manage program_categories"
  ON "program_categories" FOR ALL
  TO {public}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: equipment_types
-- ============================================================
CREATE TABLE IF NOT EXISTS "equipment_types" (
  "id" integer DEFAULT nextval('equipment_types_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX equipment_types_name_key ON public.equipment_types USING btree (name);

ALTER TABLE "equipment_types" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read equipment_types"
  ON "equipment_types" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: weekly_structures
-- ============================================================
CREATE TABLE IF NOT EXISTS "weekly_structures" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "category" text NOT NULL,
  "goal_id" uuid NOT NULL,
  "days_per_week" integer NOT NULL,
  "day_number" integer NOT NULL,
  "split_name" text NOT NULL,
  "sets" text,
  "reps" text,
  "programming_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "weekly_structures_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX weekly_structures_unique_goal_day ON public.weekly_structures USING btree (goal_id, days_per_week, day_number);
CREATE INDEX idx_weekly_structures_goal ON public.weekly_structures USING btree (goal_id);
CREATE INDEX idx_weekly_structures_days ON public.weekly_structures USING btree (days_per_week);

ALTER TABLE "weekly_structures" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read weekly_structures"
  ON "weekly_structures" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: app_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" integer DEFAULT nextval('app_settings_id_seq'::regclass) NOT NULL,
  "key" text NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX app_settings_key_key ON public.app_settings USING btree (key);

ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage app_settings"
  ON "app_settings" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: goal_program_template_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS "goal_program_template_scores" (
  "goal_id" uuid NOT NULL,
  "program_template_id" uuid NOT NULL,
  "overlap_count" integer DEFAULT 0 NOT NULL,
  "jaccard_index" numeric(5,4) DEFAULT 0 NOT NULL,
  "score" numeric(5,2) DEFAULT 0 NOT NULL,
  "shared_tag_ids" integer[] DEFAULT '{}'::integer[],
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("goal_id", "program_template_id"),
  CONSTRAINT "goal_program_template_scores_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE,
  CONSTRAINT "goal_program_template_scores_program_template_id_fkey" FOREIGN KEY ("program_template_id") REFERENCES "program_templates"("id") ON DELETE CASCADE
);

CREATE INDEX idx_gpt_scores_goal ON public.goal_program_template_scores USING btree (goal_id);
CREATE INDEX idx_gpt_scores_program ON public.goal_program_template_scores USING btree (program_template_id);
CREATE INDEX idx_gpt_scores_score ON public.goal_program_template_scores USING btree (score DESC);

ALTER TABLE "goal_program_template_scores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read goal_program_template_scores"
  ON "goal_program_template_scores" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: method_program_template_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS "method_program_template_scores" (
  "method_id" uuid NOT NULL,
  "program_template_id" uuid NOT NULL,
  "overlap_count" integer DEFAULT 0 NOT NULL,
  "jaccard_index" numeric(5,4) DEFAULT 0 NOT NULL,
  "score" numeric(5,2) DEFAULT 0 NOT NULL,
  "shared_tag_ids" integer[] DEFAULT '{}'::integer[],
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("method_id", "program_template_id"),
  CONSTRAINT "method_program_template_scores_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "methods"("id") ON DELETE CASCADE,
  CONSTRAINT "method_program_template_scores_program_template_id_fkey" FOREIGN KEY ("program_template_id") REFERENCES "program_templates"("id") ON DELETE CASCADE
);

CREATE INDEX idx_mpt_scores_method ON public.method_program_template_scores USING btree (method_id);
CREATE INDEX idx_mpt_scores_program ON public.method_program_template_scores USING btree (program_template_id);
CREATE INDEX idx_mpt_scores_score ON public.method_program_template_scores USING btree (score DESC);

ALTER TABLE "method_program_template_scores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read method_program_template_scores"
  ON "method_program_template_scores" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Phase 23: trainer-private client notes (trainer-only RLS; no
-- client policies at all). Keys on clients(id) via is_my_client_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can read their client notes"
  ON public.client_notes FOR SELECT TO authenticated
  USING (public.is_trainer() AND public.is_my_client_id(client_id));

CREATE POLICY "Trainers can add notes to their clients"
  ON public.client_notes FOR INSERT TO authenticated
  WITH CHECK (
    trainer_id = auth.uid()
    AND public.is_trainer() AND public.is_my_client_id(client_id)
  );

CREATE POLICY "Trainers can update their client notes"
  ON public.client_notes FOR UPDATE TO authenticated
  USING (public.is_trainer() AND public.is_my_client_id(client_id))
  WITH CHECK (
    trainer_id = auth.uid()
    AND public.is_trainer() AND public.is_my_client_id(client_id)
  );

CREATE POLICY "Trainers can delete their client notes"
  ON public.client_notes FOR DELETE TO authenticated
  USING (public.is_trainer() AND public.is_my_client_id(client_id));

-- ============================================================
-- Phase 24A: Web push foundation — per-device push subscriptions.
-- Owner-only policies (personal device data; no trainer access).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  subscription JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- Phase 27B: client goals (trainer-set targets per client).
-- Keys on clients(id); RLS mirrors body_composition (trainer ALL
-- for own clients, client SELECT own). The "goals" table is the
-- program-library taxonomy — unrelated.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN (
    'lose_weight','build_muscle','reduce_body_fat',
    'increase_strength','improve_fitness','custom'
  )),
  custom_label TEXT,
  target_weight_kg NUMERIC,
  target_body_fat_pct NUMERIC,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE,
  is_achieved BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT client_goals_custom_label_required
    CHECK (goal_type <> 'custom' OR (custom_label IS NOT NULL AND btrim(custom_label) <> ''))
);

ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage client goals"
  ON public.client_goals FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE trainer_id = auth.uid()));

CREATE POLICY "Clients can read own goals"
  ON public.client_goals FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
    )
  );

-- ============================================================
-- DONE! Your AzFIT database is ready.
-- ============================================================
