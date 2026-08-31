-- King Store — 0004_storage.sql
-- Public "media" bucket for banners/, products/ and brand/ assets.
-- Uploads are converted to WebP server-side (admin Server Actions)
-- before being written here — see lib/actions.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'media' and public.is_admin());

create policy "media_admin_update"
  on storage.objects for update
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

create policy "media_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'media' and public.is_admin());
