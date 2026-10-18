-- Phase 1.5: Edit menu mode (CLAUDE.md 4.5).
--
-- * import_menu_upload(): turns a checked AI reading (menu_uploads.raw_result) into menu_categories
--   + menu_items, in printed order, either replacing the current menu or adding after it.
--   Allergens arrive as "suggested"; the owner confirms them per dish in the editor.
-- * reorder_categories() / reorder_items(): save a new order in one call (drag and drop).
-- * Storage bucket `dish-images` (public read: guests load dish photos directly; file names are
--   random). Files live at `<restaurant_id>/<item_id>/<random>.jpg`; only owners write or delete.
--
-- The functions run as the caller (security invoker): RLS decides, so only owners can change
-- their own restaurant. Each call is one transaction, so a failed import leaves the menu as it was.

create function public.import_menu_upload(p_upload_id uuid, p_mode text)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  up public.menu_uploads;
  cat jsonb;
  item jsonb;
  cat_id uuid;
  cat_pos int;
  item_pos int;
begin
  if p_mode not in ('replace', 'append') then
    raise exception 'mode must be replace or append' using errcode = '22023';
  end if;
  select * into up from public.menu_uploads where id = p_upload_id;
  if up.id is null or not private.is_member(up.restaurant_id, true) then
    raise exception 'upload not found' using errcode = 'P0002';
  end if;
  if up.status not in ('needs_review', 'done') or up.raw_result is null then
    raise exception 'upload has no result' using errcode = '22023';
  end if;

  if p_mode = 'replace' then
    delete from public.menu_items where restaurant_id = up.restaurant_id;
    delete from public.menu_categories where restaurant_id = up.restaurant_id;
    delete from public.translations where restaurant_id = up.restaurant_id;
    cat_pos := 0;
  else
    select coalesce(max(sort_order) + 1, 0) into cat_pos
    from public.menu_categories where restaurant_id = up.restaurant_id;
  end if;

  for cat in select value from jsonb_array_elements(up.raw_result -> 'categories') loop
    insert into public.menu_categories (restaurant_id, name, sort_order)
    values (up.restaurant_id, left(coalesce(nullif(trim(cat ->> 'name'), ''), 'Menu'), 120), cat_pos)
    returning id into cat_id;
    cat_pos := cat_pos + 1;
    item_pos := 0;
    for item in select value from jsonb_array_elements(cat -> 'items') loop
      insert into public.menu_items (
        restaurant_id, category_id, name, price, menu_description, typical_description,
        confidence, dietary, allergens, allergen_status, sort_order
      ) values (
        up.restaurant_id, cat_id, left(item ->> 'name', 200),
        (item ->> 'price')::numeric(8, 2),
        nullif(item ->> 'menu_description', ''),
        nullif(item ->> 'typical_description', ''),
        item ->> 'confidence',
        coalesce(item -> 'dietary', '{}'::jsonb),
        array(select jsonb_array_elements_text(coalesce(item -> 'suggested_allergens', '[]'::jsonb))),
        'suggested',
        item_pos
      );
      item_pos := item_pos + 1;
    end loop;
  end loop;

  update public.menu_uploads set status = 'done' where id = p_upload_id;
end;
$$;
revoke all on function public.import_menu_upload(uuid, text) from public, anon;
grant execute on function public.import_menu_upload(uuid, text) to authenticated;

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
