-- MenuBuddy HQ, the founder's working dashboard (CLAUDE.md 1, 2): built to stay useful with
-- hundreds of restaurants. Every function answers null to anyone who is not in private.founders.
--
-- * private.ai_usage(since, until, usd_to_eur): AI cost per restaurant and job (prices from
--   private.ai_prices, longest model prefix).
-- * private.plan_mrr(plan): monthly revenue of a plan, excl. VAT (monthly €30, annual €270/12,
--   pilot €0). Billing isn't built yet, so revenue is what the plans say, not what was paid.
-- * private.hq_rows(id): one summary per restaurant: stage (setup = not online, live = online
--   with guests in the last 14 days or online for less than 14 days, quiet = online but no guests
--   for 14 days), owner email, dishes, guest visits, questions, flagged answers, AI cost this
--   month, last menu import. The demo restaurant is marked is_demo and left out of the business
--   numbers.
-- * hq_overview(): headline numbers, visits per day, the funnel and "needs attention" lists.
-- * hq_restaurants(), hq_restaurant(id): the list and one restaurant in detail.
-- * hq_leads(), hq_set_lead_status(id, status): the "Book a demo" pipeline.

create index guest_events_time_idx on public.guest_events (created_at);
create index chat_logs_flagged_idx on public.chat_logs (created_at desc) where flagged_by_owner;

create function private.is_founder()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.founders where user_id = auth.uid());
$$;

create function private.plan_mrr(p_plan text)
returns numeric
language sql immutable set search_path = '' as $$
  select case p_plan when 'monthly' then 30 when 'annual' then 22.5 else 0 end::numeric;
$$;

create function private.ai_usage(p_since timestamptz, p_until timestamptz, p_usd_to_eur numeric default 0.86)
returns table (restaurant_id uuid, kind text, calls bigint, tokens bigint, eur numeric, unpriced boolean)
language sql stable set search_path = '' as $$
  select u.restaurant_id, u.kind, count(*),
    sum(coalesce(u.input_tokens, 0) + coalesce(u.output_tokens, 0)),
    coalesce(sum((coalesce(u.input_tokens, 0) * p.input_usd_per_mtok
      + coalesce(u.output_tokens, 0) * p.output_usd_per_mtok) / 1e6), 0) * p_usd_to_eur,
    bool_or(p.model_prefix is null)
  from public.usage_events u
  left join lateral (
    select * from private.ai_prices a
    where u.model like a.model_prefix || '%'
    order by length(a.model_prefix) desc
    limit 1
  ) p on true
  where u.created_at >= p_since and u.created_at < p_until
  group by u.restaurant_id, u.kind;
$$;

create function private.month_start()
returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('month', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
$$;

create function private.hq_rows(p_id uuid default null)
returns setof jsonb
language sql stable security definer set search_path = '' as $$
  with ai as (
    select restaurant_id, sum(eur) as eur
    from private.ai_usage(private.month_start(), now() + interval '1 minute')
    where restaurant_id is not null
    group by restaurant_id
  ),
  ev as (
    select restaurant_id,
      count(*) filter (where created_at >= now() - interval '7 days') as v7,
      count(*) filter (where created_at >= now() - interval '14 days'
        and created_at < now() - interval '7 days') as vprev7,
      count(*) as v30,
      max(created_at) as last_visit
    from public.guest_events
    where kind = 'scan' and created_at >= now() - interval '30 days'
      and (p_id is null or restaurant_id = p_id)
    group by restaurant_id
  ),
  q as (
    select restaurant_id, count(*) as q30, count(*) filter (where flagged_by_owner) as f30
    from public.chat_logs
    where created_at >= now() - interval '30 days' and (p_id is null or restaurant_id = p_id)
    group by restaurant_id
  ),
  d as (
    select restaurant_id, count(*) filter (where not is_hidden) as dishes
    from public.menu_items
    where p_id is null or restaurant_id = p_id
    group by restaurant_id
  ),
  up as (
    select distinct on (restaurant_id) restaurant_id, status, error, source_type, created_at
    from public.menu_uploads
    where p_id is null or restaurant_id = p_id
    order by restaurant_id, created_at desc
  ),
  own as (
    select distinct on (m.restaurant_id) m.restaurant_id, u.email
    from public.restaurant_members m
    join auth.users u on u.id = m.user_id
    where m.role = 'owner' and (p_id is null or m.restaurant_id = p_id)
    order by m.restaurant_id, m.created_at
  )
  select jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'slug', r.slug,
    'address', r.address,
    'plan', r.plan,
    'mrr', private.plan_mrr(r.plan),
    'trial_ends_at', r.trial_ends_at,
    'created_at', r.created_at,
    'published_at', r.published_at,
    'is_published', r.is_published,
    'is_demo', r.slug = 'demo',
    'owner_email', own.email,
    'source_language', r.source_language,
    'guest_languages', r.guest_languages,
    'dishes', coalesce(d.dishes, 0),
    'visits_7d', coalesce(ev.v7, 0),
    'visits_prev_7d', coalesce(ev.vprev7, 0),
    'visits_30d', coalesce(ev.v30, 0),
    'last_visit', ev.last_visit,
    'questions_30d', coalesce(q.q30, 0),
    'flagged_30d', coalesce(q.f30, 0),
    'ai_eur_month', round(coalesce(ai.eur, 0), 4),
    'translation_failed', r.translation_status = 'failed',
    'last_upload', case when up.restaurant_id is null then null else jsonb_build_object(
      'status', up.status, 'error', up.error, 'source', up.source_type, 'at', up.created_at) end,
    'stage', case
      when not r.is_published then 'setup'
      when ev.last_visit >= now() - interval '14 days'
        or coalesce(r.published_at, r.created_at) >= now() - interval '14 days' then 'live'
      else 'quiet'
    end
  )
  from public.restaurants r
  left join ai on ai.restaurant_id = r.id
  left join ev on ev.restaurant_id = r.id
  left join q on q.restaurant_id = r.id
  left join d on d.restaurant_id = r.id
  left join up on up.restaurant_id = r.id
  left join own on own.restaurant_id = r.id
  where p_id is null or r.id = p_id
  order by r.created_at desc;
$$;

create function public.hq_restaurants()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_founder() then
    return null;
  end if;
  return coalesce((select jsonb_agg(x) from private.hq_rows() x), '[]'::jsonb);
end;
$$;

create function public.hq_overview()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not private.is_founder() then
    return null;
  end if;

  with r as (
    select x from private.hq_rows() x where not (x->>'is_demo')::boolean
  ),
  item as (
    -- One line in a "needs attention" list.
    select x, jsonb_build_object('id', x->>'id', 'name', x->>'name') as base from r
  ),
  days as (
    select d::date as day
    from generate_series(
      (now() at time zone 'Europe/Brussels')::date - 29,
      (now() at time zone 'Europe/Brussels')::date,
      interval '1 day'
    ) d
  ),
  visits as (
    select (e.created_at at time zone 'Europe/Brussels')::date as day, count(*) as n
    from public.guest_events e
    join public.restaurants rr on rr.id = e.restaurant_id and rr.slug <> 'demo'
    where e.kind = 'scan' and e.created_at >= now() - interval '31 days'
    group by 1
  ),
  ai_total as (
    select coalesce(sum(eur), 0) as eur
    from private.ai_usage(private.month_start(), now() + interval '1 minute')
  )
  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'mrr', coalesce(sum((x->>'mrr')::numeric), 0),
        'paying', count(*) filter (where x->>'plan' in ('monthly', 'annual')),
        'pilots', count(*) filter (where x->>'plan' = 'pilot'),
        'restaurants', count(*),
        'live', count(*) filter (where x->>'stage' = 'live'),
        'setup', count(*) filter (where x->>'stage' = 'setup'),
        'quiet', count(*) filter (where x->>'stage' = 'quiet'),
        'new_this_month', count(*) filter (where (x->>'created_at')::timestamptz >= private.month_start()),
        'visits_7d', coalesce(sum((x->>'visits_7d')::int), 0),
        'visits_prev_7d', coalesce(sum((x->>'visits_prev_7d')::int), 0),
        'ai_eur_month', round((select eur from ai_total), 2)
      )
      from r
    ),
    'per_day', (
      select jsonb_agg(jsonb_build_object('day', days.day, 'visits', coalesce(visits.n, 0)) order by days.day)
      from days left join visits on visits.day = days.day
    ),
    'funnel', (
      select jsonb_build_object(
        'leads', (select count(*) from public.leads),
        'signed_up', count(*),
        'menu_read', count(*) filter (where (x->>'dishes')::int > 0),
        'online', count(*) filter (where (x->>'is_published')::boolean),
        'guests', count(*) filter (where (x->>'visits_30d')::int > 0),
        'paying', count(*) filter (where x->>'plan' in ('monthly', 'annual'))
      )
      from r
    ),
    'attention', jsonb_build_object(
      'new_leads', (
        select jsonb_build_object('count', count(*), 'items', coalesce(jsonb_agg(l order by n) filter (where n <= 5), '[]'))
        from (
          select row_number() over (order by created_at) as n,
            jsonb_build_object('id', id, 'name', coalesce(restaurant_name, name),
              'note', city, 'at', created_at) as l
          from public.leads where status = 'new'
        ) s
      ),
      'stuck_setup', (
        select jsonb_build_object('count', count(*), 'items', coalesce(jsonb_agg(l order by n) filter (where n <= 5), '[]'))
        from (
          select row_number() over (order by x->>'created_at') as n,
            base || jsonb_build_object('at', x->>'created_at',
              'note', case when (x->>'dishes')::int = 0 then 'no_menu' else 'not_published' end) as l
          from item
          where x->>'stage' = 'setup' and (x->>'created_at')::timestamptz < now() - interval '3 days'
        ) s
      ),
      'quiet', (
        select jsonb_build_object('count', count(*), 'items', coalesce(jsonb_agg(l order by n) filter (where n <= 5), '[]'))
        from (
          select row_number() over (order by x->>'last_visit' nulls first) as n,
            base || jsonb_build_object('at', x->>'last_visit') as l
          from item where x->>'stage' = 'quiet'
        ) s
      ),
      'trial_ending', (
        select jsonb_build_object('count', count(*), 'items', coalesce(jsonb_agg(l order by n) filter (where n <= 5), '[]'))
        from (
          select row_number() over (order by x->>'trial_ends_at') as n,
            base || jsonb_build_object('at', x->>'trial_ends_at') as l
          from item
          where x->>'plan' = 'pilot' and (x->>'trial_ends_at')::timestamptz < now() + interval '14 days'
        ) s
      ),
      'failed_imports', (
        select jsonb_build_object('count', count(*), 'items', coalesce(jsonb_agg(l order by n) filter (where n <= 5), '[]'))
        from (
          select row_number() over (order by x->'last_upload'->>'at' desc) as n,
            base || jsonb_build_object('at', x->'last_upload'->>'at', 'note', x->'last_upload'->>'error') as l
          from item
          where x->'last_upload'->>'status' = 'failed'
            and (x->'last_upload'->>'at')::timestamptz >= now() - interval '7 days'
        ) s
      ),
      'translation_failed', (
        select jsonb_build_object('count', count(*), 'items', coalesce(jsonb_agg(l order by n) filter (where n <= 5), '[]'))
        from (
          select row_number() over (order by x->>'name') as n, base as l
          from item where (x->>'translation_failed')::boolean
        ) s
      ),
      'flagged_answers', (
        select jsonb_build_object('count', count(*), 'items', coalesce(jsonb_agg(l order by n) filter (where n <= 5), '[]'))
        from (
          select row_number() over (order by c.created_at desc) as n,
            jsonb_build_object('id', rr.id, 'name', rr.name, 'note', left(c.question, 120),
              'at', c.created_at) as l
          from public.chat_logs c
          join public.restaurants rr on rr.id = c.restaurant_id
          where c.flagged_by_owner and c.created_at >= now() - interval '30 days'
        ) s
      ),
      'high_ai_cost', (
        select jsonb_build_object('count', count(*), 'items', coalesce(jsonb_agg(l order by n) filter (where n <= 5), '[]'))
        from (
          select row_number() over (order by (x->>'ai_eur_month')::numeric desc) as n,
            base || jsonb_build_object('note', x->>'ai_eur_month') as l
          from item where (x->>'ai_eur_month')::numeric > 9
        ) s
      )
    )
  ) into result;
  return result;
end;
$$;

create function public.hq_restaurant(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  summary jsonb;
begin
  if not private.is_founder() then
    return null;
  end if;
  select x into summary from private.hq_rows(p_id) x;
  if summary is null then
    return null;
  end if;

  return summary || jsonb_build_object(
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'role', m.role) order by m.created_at), '[]')
      from public.restaurant_members m join auth.users u on u.id = m.user_id
      where m.restaurant_id = p_id
    ),
    'per_day', (
      select jsonb_agg(jsonb_build_object('day', d.day::date, 'visits', coalesce(v.n, 0)) order by d.day)
      from generate_series(
        (now() at time zone 'Europe/Brussels')::date - 29,
        (now() at time zone 'Europe/Brussels')::date,
        interval '1 day'
      ) as d(day)
      left join (
        select (created_at at time zone 'Europe/Brussels')::date as day, count(*) as n
        from public.guest_events
        where restaurant_id = p_id and kind = 'scan' and created_at >= now() - interval '31 days'
        group by 1
      ) v on v.day = d.day::date
    ),
    'languages', (
      select coalesce(jsonb_agg(jsonb_build_object('language', language, 'visits', n) order by n desc), '[]')
      from (
        select language, count(*) as n from public.guest_events
        where restaurant_id = p_id and kind = 'scan' and language is not null
          and created_at >= now() - interval '30 days'
        group by language
        order by n desc
        limit 6
      ) l
    ),
    'ai_jobs', (
      select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'calls', calls, 'tokens', tokens,
        'eur', round(eur, 4)) order by eur desc), '[]')
      from private.ai_usage(private.month_start(), now() + interval '1 minute')
      where restaurant_id = p_id
    ),
    'uploads', (
      select coalesce(jsonb_agg(jsonb_build_object('source', source_type, 'status', status,
        'error', error, 'at', created_at) order by created_at desc), '[]')
      from (
        select * from public.menu_uploads where restaurant_id = p_id
        order by created_at desc limit 5
      ) u
    ),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object('question', question, 'answer', answer,
        'type', answer_type, 'flagged', flagged_by_owner, 'language', language, 'at', created_at)
        order by created_at desc), '[]')
      from (
        select * from public.chat_logs where restaurant_id = p_id
        order by flagged_by_owner desc, created_at desc limit 10
      ) c
    )
  );
end;
$$;

create function public.hq_leads()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_founder() then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(l) order by l.created_at desc)
    from (select * from public.leads order by created_at desc limit 1000) l
  ), '[]'::jsonb);
end;
$$;

create function public.hq_set_lead_status(p_id uuid, p_status text)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_founder() then
    return false;
  end if;
  update public.leads set status = p_status where id = p_id;
  return found;
end;
$$;

revoke all on function private.is_founder(), private.plan_mrr(text),
  private.ai_usage(timestamptz, timestamptz, numeric), private.month_start(),
  private.hq_rows(uuid) from public, anon, authenticated;
revoke all on function public.hq_restaurants(), public.hq_overview(), public.hq_restaurant(uuid),
  public.hq_leads(), public.hq_set_lead_status(uuid, text) from public, anon;
grant execute on function public.hq_restaurants(), public.hq_overview(), public.hq_restaurant(uuid),
  public.hq_leads(), public.hq_set_lead_status(uuid, text) to authenticated;
