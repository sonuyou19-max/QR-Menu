-- Phase 1.4: menu photo uploads + AI cost tracking (CLAUDE.md 6, 7).
--
-- * Storage bucket `menu-uploads` (private). Files live at `<restaurant_id>/<upload_id>/<n>.jpg`.
--   Only owners of that restaurant can upload, read or delete them; the process-menu edge function
--   reads them with the service role.
-- * usage_events: tokens per AI call, per restaurant. Written only by edge functions (service role);
--   members can read their own restaurant's rows (for a later usage view).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-uploads', 'menu-uploads', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Is the current user an owner of the restaurant whose id is the first folder of this object path?
-- Compares as text, so a malformed path is simply "no" instead of a uuid cast error.
create function private.owns_upload_folder(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id::text = (storage.foldername(object_name))[1]
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;
revoke all on function private.owns_upload_folder(text) from public;
grant execute on function private.owns_upload_folder(text) to authenticated;

create policy "owners upload menu files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu-uploads' and private.owns_upload_folder(name));
create policy "owners read menu files" on storage.objects
  for select to authenticated
  using (bucket_id = 'menu-uploads' and private.owns_upload_folder(name));
create policy "owners delete menu files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-uploads' and private.owns_upload_folder(name));

create table public.usage_events (
  id bigserial primary key,
  restaurant_id uuid references public.restaurants on delete cascade,
  kind text not null check (kind in ('extract', 'translate', 'chat', 'theme')),
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);
create index usage_events_restaurant_idx on public.usage_events (restaurant_id, created_at desc);

alter table public.usage_events enable row level security;
create policy "members read usage" on public.usage_events
  for select to authenticated using (private.is_member(restaurant_id));
revoke all on public.usage_events from anon;
