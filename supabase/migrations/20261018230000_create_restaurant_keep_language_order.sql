-- create_restaurant: keep guest languages in the order the owner picked them
-- (`select distinct unnest(...)` returned them in arbitrary order). Duplicates are still removed,
-- and the menu's own language is still added at the end when it was not picked.
create or replace function public.create_restaurant(
  p_name text,
  p_slug text,
  p_address text,
  p_source_language text,
  p_guest_languages text[]
) returns public.restaurants
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  created public.restaurants;
begin
  if uid is null then
    raise exception 'not logged in' using errcode = '42501';
  end if;
  if private.is_reserved_slug(p_slug) then
    raise exception 'slug reserved' using errcode = '23505';
  end if;
  if (select count(*) from public.restaurant_members m where m.user_id = uid and m.role = 'owner') >= 5 then
    raise exception 'too many restaurants' using errcode = '54000';
  end if;

  insert into public.restaurants (name, slug, address, source_language, guest_languages)
  values (
    trim(p_name),
    p_slug,
    nullif(trim(coalesce(p_address, '')), ''),
    p_source_language,
    array(
      select lang from (
        select lang, min(pos) as first_pos
        from unnest(p_guest_languages || p_source_language) with ordinality as l(lang, pos)
        group by lang
      ) ordered
      order by first_pos
    )
  )
  returning * into created;

  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (created.id, uid, 'owner');

  return created;
end;
$$;
