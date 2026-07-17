-- ============================================================
-- AzFIT DEMO SEED
-- Creates a linked demo trainer + demo client pair with realistic
-- interactive data for local development / demos.
--
-- Demo credentials:
--   Trainer: trainer@azfit.demo / AzFitDemo2026!
--   Client:  client@azfit.demo  / AzFitDemo2026!
--
-- Run this file in the Supabase SQL Editor.
-- To remove demo data, run the DELETE DEMO DATA section at the bottom.
-- ============================================================

DO $$
DECLARE
  trainer_id UUID;
  client_user_id UUID;
  client_row_id UUID;
  program_id UUID;
  workout_id UUID;
BEGIN
  -- ─── 1. Clean existing demo data ─────────────────────────────────
  DELETE FROM clients WHERE email LIKE '%@azfit.demo';
  DELETE FROM auth.users WHERE email LIKE '%@azfit.demo';

  -- ─── 2. Auth users ─────────────────────────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'trainer@azfit.demo',
    crypt('AzFitDemo2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"sub":"trainer","role":"trainer","email":"trainer@azfit.demo","full_name":"Coach Demo (DEMO)","email_verified":true,"phone_verified":false}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  ) RETURNING id INTO trainer_id;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'client@azfit.demo',
    crypt('AzFitDemo2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"sub":"client","role":"client","email":"client@azfit.demo","full_name":"Alex Carter (DEMO)","email_verified":true,"phone_verified":false}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  ) RETURNING id INTO client_user_id;

  -- Set raw_user_meta_data.sub to the actual auth user id
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{sub}', to_jsonb(id::text))
  WHERE id IN (trainer_id, client_user_id);

  -- ─── 3. Auth identities ────────────────────────────────────────────
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), id, raw_user_meta_data, 'email', id::text, now(), now(), now()
  FROM auth.users WHERE id IN (trainer_id, client_user_id);

  -- ─── 4. Profiles (manual insert because on_auth_user_created trigger is missing live) ───
  INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
  VALUES
    (trainer_id, 'trainer@azfit.demo', 'Coach Demo (DEMO)', 'trainer', now(), now()),
    (client_user_id, 'client@azfit.demo', 'Alex Carter (DEMO)', 'client', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  -- ─── 5. Clients link row ───────────────────────────────────────────
  INSERT INTO clients (
    trainer_id, full_name, email, gender, height_cm, weight_kg, body_fat_percentage,
    fitness_goal, experience_level, status, date_of_birth, created_at, updated_at
  ) VALUES (
    trainer_id, 'Alex Carter (DEMO)', 'client@azfit.demo', 'male', 178, 80, 19,
    'Fat loss', 'intermediate', 'active', '1996-03-15', now(), now()
  ) RETURNING id INTO client_row_id;

  -- ─── 6. Sessions ────────────────────────────────────────────────────
  INSERT INTO sessions (trainer_id, client_id, title, type, status, starts_at, ends_at, location, notes, created_at)
  VALUES
    (trainer_id, client_user_id, 'Upper Body — Strength', '1-on-1', 'completed', now() - interval '3 days', (now() - interval '3 days') + interval '1 hour', 'AzFIT Gym', 'Completed demo session', now()),
    (trainer_id, client_user_id, 'Lower Body — GBC', '1-on-1', 'scheduled', (now() + interval '1 day')::date + interval '18 hours', (now() + interval '1 day')::date + interval '19 hours', 'AzFIT Gym', 'Confirmed demo session', now());

  -- ─── 7. Messages ────────────────────────────────────────────────────
  -- 6 messages alternating trainer/client; latest message to each side is unread.
  INSERT INTO messages (sender_id, receiver_id, content, read_at, created_at) VALUES
    (trainer_id, client_user_id, 'Hey Alex, great session yesterday! How are you feeling?', now() - interval '45 hours', now() - interval '45 hours'),
    (client_user_id, trainer_id, 'Feeling good coach, legs are sore but in a good way.', now() - interval '43 hours', now() - interval '43 hours'),
    (trainer_id, client_user_id, 'Good to hear. Keep protein high and stay hydrated today.', now() - interval '41 hours', now() - interval '41 hours'),
    (client_user_id, trainer_id, 'Will do. Meal prep is done for the week.', now() - interval '39 hours', now() - interval '39 hours'),
    (trainer_id, client_user_id, 'Love that discipline. See you tomorrow at 6 PM.', NULL, now() - interval '37 hours'),
    (client_user_id, trainer_id, 'See you then, coach!', NULL, now() - interval '35 hours');

  -- ─── 8. Body composition ────────────────────────────────────────────
  INSERT INTO body_composition (client_id, recorded_at, weight_kg, body_fat_percentage, chest_cm, waist_cm, hips_cm, arms_cm, thighs_cm, notes)
  VALUES
    (client_row_id, (now() - interval '21 days')::date, 82.0, 21.0, 105, 88, 98, 36, 58, 'Weekly check-in'),
    (client_row_id, (now() - interval '14 days')::date, 80.8, 20.2, 104.5, 86.5, 97.5, 35.8, 57.5, 'Weekly check-in'),
    (client_row_id, (now() - interval '7 days')::date, 79.5, 19.4, 104, 85, 97, 35.5, 57, 'Weekly check-in');

  -- ─── 9. Skinfold assessment ───────────────────────────────────────────
  INSERT INTO skinfold_assessments (client_id, assessed_by, recorded_at, protocol, sites, sum_mm, body_fat_pct, weight_kg, age_years, notes)
  VALUES (
    client_row_id,
    trainer_id,
    (now() - interval '7 days')::date,
    'jp7',
    '{"pec":12,"mid_axillary":10,"triceps":11,"subscapular":14,"umbilical":18,"supra_iliac":15,"mid_thigh":16}'::jsonb,
    106,
    15.7,
    79.5,
    30,
    'JP7 assessment'
  );

  -- ─── 10. Notifications ───────────────────────────────────────────────
  INSERT INTO notifications (user_id, title, body, type, read, created_at)
  VALUES
    (trainer_id, 'New message from Alex Carter (DEMO)', 'See you then, coach!', 'message', false, now()),
    (trainer_id, 'Session tomorrow at 6:00 PM', 'Lower Body — GBC with Alex Carter (DEMO)', 'session', false, now()),
    (client_user_id, 'New message from Coach Demo (DEMO)', 'Love that discipline. See you tomorrow at 6 PM.', 'message', false, now()),
    (client_user_id, 'Session tomorrow at 6:00 PM', 'Lower Body — GBC at AzFIT Gym', 'session', false, now());

  -- ─── 11. Program / workout / exercises ───────────────────────────────
  INSERT INTO programs (trainer_id, client_id, name, description, duration_weeks, frequency_per_week, status, start_date, end_date, created_at, updated_at)
  VALUES (trainer_id, client_row_id, 'GBC Phase 1 (DEMO)', 'German Body Composition demo program', 4, 3, 'active', CURRENT_DATE, CURRENT_DATE + interval '28 days', now(), now())
  RETURNING id INTO program_id;

  INSERT INTO workouts (program_id, name, day_of_week, week_number, notes, created_at, updated_at)
  VALUES (program_id, 'Lower Body A', 3, 1, 'Demo lower body session', now(), now())
  RETURNING id INTO workout_id;

  INSERT INTO exercises (workout_id, name, sets, reps, weight_kg, rest_seconds, rpe, order_index, notes, created_at)
  VALUES
    (workout_id, 'Back Squat', 4, '8-10', 80, 120, 8, 0, 'Demo exercise', now()),
    (workout_id, 'Romanian Deadlift', 3, '10-12', 70, 90, 7, 1, 'Demo exercise', now()),
    (workout_id, 'Walking Lunge', 3, '12 each', 20, 60, 7, 2, 'Demo exercise', now());
END $$;

-- ============================================================
-- DELETE DEMO DATA
-- Run this section to remove all demo users and their linked data.
-- auth.users cascade-deletes profiles; other tables delete by demo email.
-- ============================================================
--
-- DELETE FROM clients WHERE email LIKE '%@azfit.demo';
-- DELETE FROM auth.users WHERE email LIKE '%@azfit.demo';
