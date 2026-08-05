-- Phase 44 — check_in_submissions policy additions (NO new table:
-- the phase builds on the existing form/submission system).
-- 1) Clients may EDIT their own current-week submission (brief Item 1).
-- 2) Trainers may enter a check-in ON BEHALF of a client (brief Item 3 —
--    account-less clients get trainer-side entry).
-- Both mirror the exact patterns already on this table. Idempotent.

drop policy if exists "Clients can update own submissions" on public.check_in_submissions;
create policy "Clients can update own submissions"
  on public.check_in_submissions for update
  using (
    exists (
      select 1 from clients c
      join profiles p on p.id = auth.uid()
      where c.id = check_in_submissions.client_id and c.email = p.email
    )
  )
  with check (
    exists (
      select 1 from clients c
      join profiles p on p.id = auth.uid()
      where c.id = check_in_submissions.client_id and c.email = p.email
    )
  );

drop policy if exists "Trainers can insert submissions for their clients" on public.check_in_submissions;
create policy "Trainers can insert submissions for their clients"
  on public.check_in_submissions for insert
  with check (
    form_id in (select id from public.check_in_forms where trainer_id = auth.uid())
    and client_id in (select id from public.clients where trainer_id = auth.uid())
  );
