-- Phase 1.9b: Buddy suggests a look (suggest-theme). So the suggestion stands out, the function
-- gets the looks (only the look settings, never names or addresses) of restaurants in the same
-- area. Only the service role (edge functions) may call it.

create function public.nearby_looks(p_restaurant uuid) returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select r.theme - 'tagline' - 'cover_path'
  from public.restaurants me
  join public.restaurants r
    on r.id <> me.id
   and r.theme <> '{}'::jsonb
   and private.address_area(r.address) = private.address_area(me.address)
  where me.id = p_restaurant
  limit 50;
$$;
revoke all on function public.nearby_looks(uuid) from public, anon, authenticated;
grant execute on function public.nearby_looks(uuid) to service_role;
