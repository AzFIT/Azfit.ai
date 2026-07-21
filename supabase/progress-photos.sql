-- AzFIT Progress Photos Storage Setup
-- Bucket: progress-photos (private)
-- RLS: each user can only touch objects inside their own folder: user_id/filename

-- Create the private bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- Ensure RLS is enabled on storage.objects
alter table storage.objects enable row level security;

-- Drop existing policies for this bucket to avoid duplicates during re-runs
drop policy if exists "progress-photos_select" on storage.objects;
drop policy if exists "progress-photos_insert" on storage.objects;
drop policy if exists "progress-photos_update" on storage.objects;
drop policy if exists "progress-photos_delete" on storage.objects;

-- SELECT: users can read only objects in their own folder
create policy "progress-photos_select"
on storage.objects
for select
to authenticated
using ((storage.foldername(name))[1] = auth.uid()::text);

-- INSERT: users can only upload into their own folder
create policy "progress-photos_insert"
on storage.objects
for insert
to authenticated
with check ((storage.foldername(name))[1] = auth.uid()::text);

-- UPDATE: users can only rename/update objects in their own folder
create policy "progress-photos_update"
on storage.objects
for update
to authenticated
using ((storage.foldername(name))[1] = auth.uid()::text)
with check ((storage.foldername(name))[1] = auth.uid()::text);

-- DELETE: users can only remove objects in their own folder
create policy "progress-photos_delete"
on storage.objects
for delete
to authenticated
using ((storage.foldername(name))[1] = auth.uid()::text);
