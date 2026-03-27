-- Public chat media bucket + RLS. Realtime for in-app notifications.
-- Rollback: drop chat_media_* policies; optionally delete storage bucket chat-media if unused; remove public.app_notifications from publication supabase_realtime.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/webm', 'audio/mp4', 'audio/mpeg']
)
on conflict (id) do nothing;

drop policy if exists "chat_media_insert_own" on storage.objects;
create policy "chat_media_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat_media_select_public" on storage.objects;
create policy "chat_media_select_public"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat-media');

drop policy if exists "chat_media_update_own" on storage.objects;
create policy "chat_media_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "chat_media_delete_own" on storage.objects;
create policy "chat_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
begin
  alter publication supabase_realtime add table public.app_notifications;
exception
  when duplicate_object then null;
end $$;
