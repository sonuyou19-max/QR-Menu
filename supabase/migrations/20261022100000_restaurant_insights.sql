-- Step 15, part 2: the owner's insights on the overview (CLAUDE.md 3 owner flow 11).
--
-- restaurant_insights(restaurant, days): visits per day (zeros included, in Brussels time),
-- totals, guest languages and the most opened / most added dishes over the last `days` days, in
-- one small answer for the phone. Owners of the restaurant only (SECURITY DEFINER with an owner
-- check, so the phone doesn't have to download raw events). Guest questions are read straight
-- from chat_logs (owners already may, and may flag them).

create function public.restaurant_insights(p_restaurant uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  days int := least(greatest(coalesce(p_days, 30), 1), 366);
  since timestamptz;
begin
  if not private.is_member(p_restaurant, true) then
    return null;
  end if;
  since := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels'
    - make_interval(days => days - 1);

  return jsonb_build_object(
    'days', days,
    'per_day', (
      select jsonb_agg(jsonb_build_object('day', d.day::date, 'visits', coalesce(v.n, 0)) order by d.day)
      from generate_series(
        (since at time zone 'Europe/Brussels')::date,
        (now() at time zone 'Europe/Brussels')::date,
        interval '1 day'
      ) as d(day)
      left join (
        select (created_at at time zone 'Europe/Brussels')::date as day, count(*) as n
        from public.guest_events
        where restaurant_id = p_restaurant and kind = 'scan' and created_at >= since
        group by 1
      ) v on v.day = d.day::date
    ),
    'totals', (
      select jsonb_build_object(
        'visits', count(*) filter (where kind = 'scan'),
        'added', count(*) filter (where kind = 'add_to_cart'),
        'shown_to_staff', count(*) filter (where kind = 'show_to_staff'),
        'questions', (
          select count(*) from public.chat_logs
          where restaurant_id = p_restaurant and created_at >= since
        )
      )
      from public.guest_events
      where restaurant_id = p_restaurant and created_at >= since
    ),
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object('language', language, 'visits', n) order by n desc)
      from (
        select language, count(*) as n
        from public.guest_events
        where restaurant_id = p_restaurant and kind = 'scan' and created_at >= since
          and language is not null
        group by language
      ) l
    ), '[]'::jsonb),
    'top_viewed', private.top_dishes(p_restaurant, 'view_item', since),
    'top_added', private.top_dishes(p_restaurant, 'add_to_cart', since)
  );
end;
$$;

-- The 5 dishes with the most events of one kind (name as on the menu; deleted dishes left out).
create function private.top_dishes(p_restaurant uuid, p_kind text, p_since timestamptz)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'count', n) order by n desc, name), '[]'::jsonb)
  from (
    select i.id, i.name, count(*) as n
    from public.guest_events e
    join public.menu_items i on i.id = e.item_id and i.restaurant_id = p_restaurant
    where e.restaurant_id = p_restaurant and e.kind = p_kind and e.created_at >= p_since
    group by i.id, i.name
    order by n desc, i.name
    limit 5
  ) t;
$$;

revoke all on function public.restaurant_insights(uuid, int) from public, anon;
grant execute on function public.restaurant_insights(uuid, int) to authenticated;
revoke all on function private.top_dishes(uuid, text, timestamptz) from public, anon, authenticated;
