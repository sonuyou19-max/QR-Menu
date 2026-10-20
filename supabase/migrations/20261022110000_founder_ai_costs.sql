-- Step 15, part 3: AI cost view for the founder only (CLAUDE.md 10 step 15), not for restaurant
-- owners.
--
-- * usage_events.kind gets 'demo' (the marketing site's "Try your own menu": no restaurant;
--   demo_runs is emptied after 24 h, so its tokens are logged here too, otherwise a month's demo
--   cost would be gone) and 'dish' (reserved for suggest-dish, which still logs as 'extract').
-- * private.founders: the accounts that may see the cost view. Filled by hand in the SQL editor
--   (insert into private.founders (user_id) values ('<user id>')), never by the app.
-- * private.ai_prices: USD per million tokens per model. A model matches the longest prefix
--   ('claude-haiku-4-5' matches 'claude-haiku-4-5-20251001'). Update a price with SQL; an unknown
--   model shows as "price unknown" instead of costing nothing.
-- * founder_ai_costs(month, usd_to_eur): per restaurant (plus one demo line), tokens and cost per
--   job in that calendar month (Brussels time). Null for anyone who is not a founder.
-- * is_founder(): lets the app show the link to the view.

alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check
  check (kind in ('extract', 'translate', 'chat', 'theme', 'dish', 'demo'));
create index usage_events_time_idx on public.usage_events (created_at);

create table private.founders (
  user_id uuid primary key references auth.users on delete cascade
);

create table private.ai_prices (
  model_prefix text primary key,
  input_usd_per_mtok numeric not null check (input_usd_per_mtok >= 0),
  output_usd_per_mtok numeric not null check (output_usd_per_mtok >= 0)
);
insert into private.ai_prices values
  ('claude-sonnet-5-5', 2, 10),
  ('claude-haiku-4-5', 1, 5),
  ('claude-haiku-5-5', 0.10, 0.50);

create function public.is_founder()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.founders where user_id = auth.uid());
$$;

create function public.founder_ai_costs(p_month date default null, p_usd_to_eur numeric default 0.86)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start date := date_trunc('month', coalesce(p_month, (now() at time zone 'Europe/Brussels')::date))::date;
  since timestamptz := month_start::timestamp at time zone 'Europe/Brussels';
  until timestamptz := (month_start + interval '1 month')::timestamp at time zone 'Europe/Brussels';
begin
  if not exists (select 1 from private.founders where user_id = auth.uid()) then
    return null;
  end if;

  return jsonb_build_object(
    'month', month_start,
    'usd_to_eur', p_usd_to_eur,
    'prices', (
      select jsonb_agg(jsonb_build_object('model', model_prefix, 'input', input_usd_per_mtok,
        'output', output_usd_per_mtok) order by model_prefix)
      from private.ai_prices
    ),
    'rows', coalesce((
      with priced as (
        select u.restaurant_id, u.kind, u.model,
          coalesce(u.input_tokens, 0) as input_tokens,
          coalesce(u.output_tokens, 0) as output_tokens,
          (coalesce(u.input_tokens, 0) * p.input_usd_per_mtok
            + coalesce(u.output_tokens, 0) * p.output_usd_per_mtok) / 1e6 as usd
        from public.usage_events u
        left join lateral (
          select * from private.ai_prices a
          where u.model like a.model_prefix || '%'
          order by length(a.model_prefix) desc
          limit 1
        ) p on true
        where u.created_at >= since and u.created_at < until
      ),
      per_kind as (
        select restaurant_id, kind,
          count(*) as calls,
          sum(input_tokens) as input_tokens,
          sum(output_tokens) as output_tokens,
          sum(usd) as usd,
          bool_or(usd is null) as unpriced
        from priced
        group by restaurant_id, kind
      )
      select jsonb_agg(row_data order by (row_data->>'eur')::numeric desc nulls last)
      from (
        select jsonb_build_object(
          'restaurant_id', k.restaurant_id,
          'name', case when k.restaurant_id is null then null else r.name end,
          'slug', r.slug,
          'plan', r.plan,
          'eur', round(sum(coalesce(k.usd, 0)) * p_usd_to_eur, 4),
          'unpriced', bool_or(k.unpriced),
          'kinds', jsonb_object_agg(k.kind, jsonb_build_object(
            'calls', k.calls,
            'input_tokens', k.input_tokens,
            'output_tokens', k.output_tokens,
            'eur', round(coalesce(k.usd, 0) * p_usd_to_eur, 4)
          ))
        ) as row_data
        from per_kind k
        left join public.restaurants r on r.id = k.restaurant_id
        group by k.restaurant_id, r.name, r.slug, r.plan
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.is_founder() from public, anon;
revoke all on function public.founder_ai_costs(date, numeric) from public, anon;
grant execute on function public.is_founder() to authenticated;
grant execute on function public.founder_ai_costs(date, numeric) to authenticated;
