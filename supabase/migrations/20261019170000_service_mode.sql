-- Phase 1.5b: Service mode (CLAUDE.md 4.5).
--
-- * set_stock(ids, in_stock): switch dishes in/out of stock. SECURITY DEFINER so staff accounts
--   (role 'staff', later) can do this one thing without write access to menu_items; it only
--   touches in_stock, and only for dishes of restaurants the caller is a member of. Returns the
--   ids it changed (used for Undo).
-- * reset_stock(restaurant): "Reset all for next service": every out-of-stock dish back in
--   stock. Returns the ids it changed, so the app can undo it.
-- * menu_items joins the supabase_realtime publication: other phones (and later the guest menu)
--   see stock changes at once. Realtime applies RLS, so members only receive their own dishes.

create function public.set_stock(p_item_ids uuid[], p_in_stock boolean)
returns setof uuid
language sql security definer set search_path = '' as $$
  update public.menu_items
  set in_stock = p_in_stock
  where id = any (p_item_ids)
    and in_stock is distinct from p_in_stock
    and private.is_member(restaurant_id)
  returning id;
$$;
revoke all on function public.set_stock(uuid[], boolean) from public, anon;
grant execute on function public.set_stock(uuid[], boolean) to authenticated;

create function public.reset_stock(p_restaurant_id uuid)
returns setof uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member(p_restaurant_id) then
    raise exception 'restaurant not found' using errcode = 'P0002';
  end if;
  return query
    update public.menu_items
    set in_stock = true
    where restaurant_id = p_restaurant_id and not in_stock
    returning id;
end;
$$;
revoke all on function public.reset_stock(uuid) from public, anon;
grant execute on function public.reset_stock(uuid) to authenticated;

alter publication supabase_realtime add table public.menu_items;
