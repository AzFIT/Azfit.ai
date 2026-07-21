-- AzFIT Check-ins / Habits demo seed
-- For demo accounts: trainer@azfit.demo + client@azfit.demo

DO $$
DECLARE
  trainer_uuid UUID;
  client_uuid UUID;
BEGIN
  SELECT id INTO trainer_uuid FROM profiles WHERE email = 'trainer@azfit.demo' LIMIT 1;
  SELECT id INTO client_uuid FROM clients WHERE email = 'client@azfit.demo' LIMIT 1;

  IF trainer_uuid IS NULL THEN
    RAISE EXCEPTION 'Demo trainer profile not found (trainer@azfit.demo)';
  END IF;

  IF client_uuid IS NULL THEN
    RAISE EXCEPTION 'Demo client record not found (client@azfit.demo)';
  END IF;

  -- One check-in form
  INSERT INTO check_in_forms (trainer_id, title, description, fields, frequency, active)
  SELECT
    trainer_uuid,
    'Weekly Check-in',
    NULL,
    '[
      {"key":"weight","label":"Current weight (kg)","type":"number"},
      {"key":"sleep","label":"Average sleep quality (1-10)","type":"scale"},
      {"key":"energy","label":"Energy levels (1-10)","type":"scale"},
      {"key":"adherence","label":"Did you hit all sessions this week?","type":"yesno"},
      {"key":"notes","label":"Anything your coach should know?","type":"text"}
    ]'::jsonb,
    'weekly',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM check_in_forms WHERE trainer_id = trainer_uuid AND title = 'Weekly Check-in'
  );

  -- Two demo habits
  INSERT INTO habits (trainer_id, client_id, name, target_frequency, active)
  SELECT trainer_uuid, client_uuid, 'Drink 2L water', 'daily', true
  WHERE NOT EXISTS (
    SELECT 1 FROM habits WHERE trainer_id = trainer_uuid AND client_id = client_uuid AND name = 'Drink 2L water'
  );

  INSERT INTO habits (trainer_id, client_id, name, target_frequency, active)
  SELECT trainer_uuid, client_uuid, '10k steps', 'daily', true
  WHERE NOT EXISTS (
    SELECT 1 FROM habits WHERE trainer_id = trainer_uuid AND client_id = client_uuid AND name = '10k steps'
  );
END
$$;

-- Verification: show the seeded rows
SELECT id, title, frequency, active, fields FROM check_in_forms WHERE title = 'Weekly Check-in';
SELECT id, trainer_id, client_id, name, target_frequency, active FROM habits WHERE name IN ('Drink 2L water', '10k steps') ORDER BY name;
