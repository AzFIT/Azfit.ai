-- AzFIT AI Chat Stage 1 Schema
-- Tables: faq_entries, chat_messages, chat_events, chat_feedback

-- FAQ entries (read-only for clients, managed by trainers/admins via SQL/dashboard)
create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  keywords text[] not null default '{}',
  roles text[] not null default '{trainer,client}',
  created_at timestamptz default now()
);

-- Chat messages (one row per user/assistant exchange side)
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  intent text,
  tokens_input int,
  tokens_output int,
  model_used text,
  latency_ms int,
  created_at timestamptz default now()
);

-- Chat events (action clicks, safety flags, etc.)
create table if not exists public.chat_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_type text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Chat feedback (thumbs up/down on messages)
create table if not exists public.chat_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.chat_messages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  rating int not null check (rating in (-1, 1)),
  created_at timestamptz default now()
);

-- Indexes
create index if not exists chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);
create index if not exists chat_events_user_type_idx on public.chat_events (user_id, event_type);
create index if not exists faq_entries_keywords_idx on public.faq_entries using gin (keywords);

-- Enable RLS
alter table public.faq_entries enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_events enable row level security;
alter table public.chat_feedback enable row level security;

-- Drop existing policies to avoid duplicates on re-run
drop policy if exists "FAQ read authenticated" on public.faq_entries;
drop policy if exists "Users insert own messages" on public.chat_messages;
drop policy if exists "Users select own messages" on public.chat_messages;
drop policy if exists "Users insert own events" on public.chat_events;
drop policy if exists "Users select own events" on public.chat_events;
drop policy if exists "Users insert own feedback" on public.chat_feedback;
drop policy if exists "Users select own feedback" on public.chat_feedback;

-- FAQ: read only for authenticated users
create policy "FAQ read authenticated"
  on public.faq_entries
  for select
  to authenticated
  using (true);

-- Chat messages: own only
-- Note: do not reference public.profiles inside this policy to avoid recursion.
create policy "Users insert own messages"
  on public.chat_messages
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users select own messages"
  on public.chat_messages
  for select
  to authenticated
  using (user_id = auth.uid());

-- Chat events: own only
create policy "Users insert own events"
  on public.chat_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users select own events"
  on public.chat_events
  for select
  to authenticated
  using (user_id = auth.uid());

-- Chat feedback: own only
create policy "Users insert own feedback"
  on public.chat_feedback
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users select own feedback"
  on public.chat_feedback
  for select
  to authenticated
  using (user_id = auth.uid());

-- Seed FAQ entries
insert into public.faq_entries (question, answer, keywords, roles) values
  ('How do I start a workout?', 'Head to the Dashboard and tap “Start Workout,” or go to /sheets and select a workout log. Your trainer-assigned program will load automatically.', array['workout', 'start', 'begin', 'session', 'sheets'], '{trainer,client}'),
  ('How do I log weight or measurements?', 'Go to /bioprint, tap “Log Assessment,” and enter your weight, body-fat percentage, and measurements. Trainers can also log this for clients.', array['weight', 'measurements', 'body fat', 'bioprint', 'log'], '{trainer,client}'),
  ('How do I message my coach?', 'Open /messages, choose your coach from the list, and send a message. You’ll get a notification badge for unread replies.', array['message', 'coach', 'chat', 'contact', 'trainer'], '{client}'),
  ('How do check-ins work?', 'Trainers create check-in forms at /check-ins. Clients fill them out, and trainers review submissions and add notes. Habits are tracked separately on the same page.', array['check-ins', 'check in', 'form', 'submission', 'review'], '{trainer,client}'),
  ('How do habits work?', 'Trainers assign habits to clients at /check-ins. Clients mark habits done for today on the Check-ins page or the client dashboard card. Streaks and weekly completion are shown automatically.', array['habits', 'streak', 'daily', 'water', 'steps'], '{trainer,client}'),
  ('How do I add a client?', 'Go to /clients and tap “Add New Client.” Fill in their details and save. The client will appear in your list and can log in with the email you provide.', array['add client', 'new client', 'onboard', 'clients'], '{trainer}'),
  ('How do I build a program?', 'Use the Program Builder at /program-builder to create workouts, add exercises, sets, reps, and rest periods. You can also try the AI Program Builder at /ai-program-builder.', array['build program', 'create program', 'program builder', 'workout plan'], '{trainer}'),
  ('How do I view client progress?', 'Go to /clients, select a client, and open their profile. You’ll see body composition, progress photos, workout history, and check-in submissions.', array['client progress', 'view progress', 'photos', 'history'], '{trainer}'),
  ('How do I log food?', 'Visit /nutrition to log meals and track macros. You can also ask the AI coach for guidance on hitting your targets.', array['food', 'log food', 'nutrition', 'meal', 'macros'], '{trainer,client}'),
  ('Where are my progress photos?', 'Progress photos are stored in Supabase Storage under the private progress-photos bucket. View them at /progress-photos and upload new ones from the same page.', array['progress photos', 'photos', 'upload', 'before after'], '{trainer,client}')
on conflict (id) do nothing;
