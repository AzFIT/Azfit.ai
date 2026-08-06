-- Phase 50 — session_packages + trainer_availability (pre-approved additive).
-- RLS mirrors the 27B client_goals pattern: trainers manage rows for their
-- own clients / own availability; clients read their own packages and their
-- trainer's availability (email → profiles resolution).
-- Credits are DERIVATIVE (no counter column): remaining = total_credits −
-- sessions (scheduled|completed) created on/after the earliest package's
-- created_at — the packages form a pool (documented in PROGRESS.md).

create table if not exists public.session_packages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  trainer_id uuid not null references public.profiles(id),
  name text not null,
  total_credits int not null check (total_credits > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.trainer_availability (
  id uuid primary key default uuid_generate_v4(),
  trainer_id uuid not null references public.profiles(id),
  weekday int check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  blocked_date date,
  unique (trainer_id, weekday, start_time)
);

alter table public.session_packages enable row level security;
alter table public.trainer_availability enable row level security;

-- session_packages: trainer manages rows for their clients
drop policy if exists "Trainers can manage session packages" on public.session_packages;
create policy "Trainers can manage session packages"
  on public.session_packages for all
  using (client_id in (select id from public.clients where trainer_id = auth.uid()))
  with check (client_id in (select id from public.clients where trainer_id = auth.uid()));

-- session_packages: clients read their own packages
drop policy if exists "Clients can read own session packages" on public.session_packages;
create policy "Clients can read own session packages"
  on public.session_packages for select
  using (
    client_id in (
      select c.id from public.clients c
      join public.profiles p on p.id = auth.uid()
      where c.email = p.email
    )
  );

-- trainer_availability: trainer manages own rows
drop policy if exists "Trainers manage own availability" on public.trainer_availability;
create policy "Trainers manage own availability"
  on public.trainer_availability for all
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

-- trainer_availability: clients read their trainer's availability
drop policy if exists "Clients can read trainer availability" on public.trainer_availability;
create policy "Clients can read trainer availability"
  on public.trainer_availability for select
  using (
    trainer_id in (
      select c.trainer_id from public.clients c
      join public.profiles p on p.id = auth.uid()
      where c.email = p.email
    )
  );
