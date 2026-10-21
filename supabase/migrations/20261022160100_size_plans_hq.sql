-- Plans by size, part 2 (see 20261022160000_size_plans): HQ knows each restaurant's plan size,
-- seats and visits of the 30 days before, computes revenue with private.plan_mrr(plan, size), and
-- lists restaurants above their plan in both of the last two 30-day periods under "needs
-- attention" (above_plan).

create or replace function private.hq_rows(p_id uuid default null)
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
      count(*) filter (where created_at >= now() - interval '30 days') as v30,
      count(*) filter (where created_at < now() - interval '30 days') as vprev30,
      max(created_at) as last_visit
    from public.guest_events
    where kind = 'scan' and created_at >= now() - interval '60 days'
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
    'plan_size', r.plan_size,
    'seats', r.seats,
    'mrr', private.plan_mrr(r.plan, r.plan_size),
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
    'visits_prev_30d', coalesce(ev.vprev30, 0),
    'visit_limit', private.plan_visit_limit(r.plan_size),
    -- Well above its plan in both of the last two 30-day periods: suggest the next plan.
    'above_plan', coalesce(coalesce(ev.v30, 0) > private.plan_visit_limit(r.plan_size)
      and coalesce(ev.vprev30, 0) > private.plan_visit_limit(r.plan_size), false),
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

create or replace function public.hq_overview()
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
      'above_plan', (
        select jsonb_build_object('count', count(*), 'items', coalesce(jsonb_agg(l order by n) filter (where n <= 5), '[]'))
        from (
          select row_number() over (order by (x->>'visits_30d')::int desc) as n,
            base || jsonb_build_object('note', x->>'plan_size', 'at', null,
              'visits', (x->>'visits_30d')::int) as l
          from item where (x->>'above_plan')::boolean
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
