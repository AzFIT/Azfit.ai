-- Fix infinite recursion in profiles RLS policy
-- A SELECT policy on profiles that subqueries profiles causes infinite recursion.
-- Replace the self-referencing EXISTS with a SECURITY DEFINER function that bypasses RLS.

create or replace function public.is_trainer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'trainer');
$$;

drop policy if exists "Trainers can read all profiles" on profiles;

create policy "Trainers can read all profiles"
  on profiles for select
  using (public.is_trainer());
