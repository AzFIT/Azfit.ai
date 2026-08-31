-- Owner Tasks (feat/session-nav-polish), Task 3 — ONE-TIME data fix.
-- Ben Sabre's active program "5x5" (d9483b16-d8c5-459f-9cd0-dbead4aec82f) was
-- saved when the wizard's Full Body split left every day on the shared default
-- list, so Full Body A/B/C held the identical 6 exercises. This rewrites the
-- day lineups IN PLACE (ids stable — workout_log history links preserved) to
-- the distinct A/B/C rotation shipped in src/lib/fullBodyRotation.ts.
-- Idempotent: fixed-value UPDATEs keyed by workout name + order_index.
-- NOT a schema change — do not mirror into schema.sql.

-- ── Day A: row + RDL accessories, plank core (orders 2, 3, 5 change) ──
update public.exercises e set name = 'Barbell Row', sets = 4, reps = '8', rest_seconds = 150,
  notes = '{"tempo":"3-1-1-0","pct1RM":"75%"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body A' and e.order_index = 2;

update public.exercises e set name = 'Romanian Deadlift', sets = 3, reps = '8', rest_seconds = 150,
  notes = '{"tempo":"3-1-1-0","pct1RM":"75%"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body A' and e.order_index = 3;

update public.exercises e set name = 'Plank', sets = 3, reps = '45s', rest_seconds = 90,
  notes = '{"tempo":"2-0-1-0","pct1RM":"N/A"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body A' and e.order_index = 5;

-- ── Day B: overhead emphasis, deadlift + pulldown accessories ──
update public.exercises e set name = 'Overhead Press', sets = 5, reps = '5', rest_seconds = 180,
  notes = '{"tempo":"2-0-1-1","pct1RM":"80%"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body B' and e.order_index = 1;

update public.exercises e set name = 'Deadlift', sets = 4, reps = '5', rest_seconds = 180,
  notes = '{"tempo":"2-1-X-0","pct1RM":"85%"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body B' and e.order_index = 2;

update public.exercises e set name = 'Lat Pulldown', sets = 4, reps = '8', rest_seconds = 150,
  notes = '{"tempo":"3-0-2-0","pct1RM":"75%"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body B' and e.order_index = 3;

update public.exercises e set name = 'Bulgarian Split Squat', sets = 3, reps = '8/leg', rest_seconds = 120,
  notes = '{"tempo":"2-0-1-0","pct1RM":"N/A"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body B' and e.order_index = 4;

update public.exercises e set name = 'Side Plank', sets = 3, reps = '30s/side', rest_seconds = 90,
  notes = '{"tempo":"2-0-1-0","pct1RM":"N/A"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body B' and e.order_index = 5;

-- ── Day C: bench volume (varied scheme), pull-up + hip thrust ──
update public.exercises e set name = 'Back Squat', sets = 4, reps = '6', rest_seconds = 180,
  notes = '{"tempo":"3-0-1-0","pct1RM":"80%"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body C' and e.order_index = 0;

update public.exercises e set name = 'Bench Press', sets = 4, reps = '6', rest_seconds = 180,
  notes = '{"tempo":"3-1-1-0","pct1RM":"80%"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body C' and e.order_index = 1;

update public.exercises e set name = 'Pull-Up', sets = 4, reps = '8', rest_seconds = 150,
  notes = '{"tempo":"3-0-2-0","pct1RM":"BW"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body C' and e.order_index = 2;

update public.exercises e set name = 'Hip Thrust', sets = 3, reps = '10', rest_seconds = 120,
  notes = '{"tempo":"2-0-1-0","pct1RM":"75%"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body C' and e.order_index = 3;

update public.exercises e set name = 'Goblet Squat', sets = 3, reps = '12', rest_seconds = 90,
  notes = '{"tempo":"2-0-1-0","pct1RM":"N/A"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body C' and e.order_index = 4;

update public.exercises e set name = 'Dead Bug', sets = 3, reps = '8/side', rest_seconds = 90,
  notes = '{"tempo":"2-0-1-0","pct1RM":"N/A"}'
from public.workouts w
where e.workout_id = w.id and w.program_id = 'd9483b16-d8c5-459f-9cd0-dbead4aec82f'
  and w.name = 'Full Body C' and e.order_index = 5;
