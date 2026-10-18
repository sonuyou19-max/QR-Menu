-- Phase 1.5: Edit menu mode (CLAUDE.md 4.5).
--
-- * import_menu_upload(): see 20261019120100_import_menu_upload.sql.
-- * reorder_categories() / reorder_items(): save a new order in one call (drag and drop).
-- * Storage bucket `dish-images` (public read: guests load dish photos directly; file names are
--   random). Files live at `<restaurant_id>/<item_id>/<random>.jpg`; only owners write or delete.
--
-- The functions run as the caller (security invoker): RLS decides, so only owners can change
-- their own restaurant.

-- New category order: position in the array = sort_order.
create function public.reorder_categories(p_ids uuid[])
returns void
language sql security invoker set search_path = '' as $$
  update public.menu_categories c set sort_order = o.pos - 1
  from unnest(p_ids) with ordinality as o(id, pos)
  where c.id = o.id;
$$;
revoke all on function public.reorder_categories(uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid[]) to authenticated;

-- New dish order inside one category (also moves dishes into it).
create function public.reorder_items(p_category_id uuid, p_ids uuid[])
returns void
language sql security invoker set search_path = '' as $$
  update public.menu_items i set sort_order = o.pos - 1, category_id = p_category_id
  from unnest(p_ids) with ordinality as o(id, pos)
  where i.id = o.id;
$$;
revoke all on function public.reorder_items(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_items(uuid, uuid[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-images', 'dish-images', true, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "owners upload dish images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dish-images' and private.owns_upload_folder(name));
create policy "owners delete dish images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dish-images' and private.owns_upload_folder(name));
-- Deleting through the Storage API also needs read access to the row.
create policy "owners read dish images" on storage.objects
  for select to authenticated
  using (bucket_id = 'dish-images' and private.owns_upload_folder(name));
