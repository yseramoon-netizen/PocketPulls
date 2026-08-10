-- Ancient Pulls v59: player profile-picture uploads.
--
-- Each authenticated player may upload only into a folder matching their own
-- auth user id. Images are public because public profiles, friends and the
-- leaderboard display the selected portrait.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'player-avatars',
  'player-avatars',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Ancient Pulls public avatar read" on storage.objects;
drop policy if exists "Ancient Pulls player avatar insert" on storage.objects;
drop policy if exists "Ancient Pulls player avatar update" on storage.objects;
drop policy if exists "Ancient Pulls player avatar delete" on storage.objects;

create policy "Ancient Pulls public avatar read"
on storage.objects
for select
to public
using (bucket_id = 'player-avatars');

create policy "Ancient Pulls player avatar insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'player-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Ancient Pulls player avatar update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'player-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'player-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Ancient Pulls player avatar delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'player-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
