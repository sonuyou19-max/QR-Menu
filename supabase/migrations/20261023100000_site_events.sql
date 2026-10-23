-- Website statistics, part 2 (step 0.5): button clicks on brisolo.be, next to Cloudflare Web
-- Analytics (which counts visits and pages, cookie-free, but no clicks).
--
-- * site_events: one row per click on a button that carries data-cta on the marketing site
--   (header/hero/pricing/footer "Book a demo", "open the demo", "try your own menu" …). No
--   personal data: only the button's name, the page language and the time.
-- * track_site_event(label, lang): the only way in, callable by anyone (the site has no login).
--   Bad labels are ignored and at most 5,000 clicks a day are stored, so a script can't fill the
--   table. Kept 13 months (pg_cron, daily).
-- * hq_site_stats(): founder-only summary for Brisolo HQ: clicks per button for the last 30 days
--   and the 30 before, plus demo requests (leads) and "try your menu" runs (usage_events kind
--   demo), which the server already records.

create table public.site_events (
  id bigint generated always as identity primary key,
  label text not null check (label ~ '^[a-z0-9-]{1,40}$'),
  lang text check (lang in ('nl', 'fr', 'en')),
  created_at timestamptz not null default now()
);
create index site_events_time_idx on public.site_events (created_at);

alter table public.site_events enable row level security;
revoke all on public.site_events from anon, authenticated;
grant select, insert, delete on public.site_events to service_role;

create function public.track_site_event(p_label text, p_lang text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_label is null or p_label !~ '^[a-z0-9-]{1,40}$' then
    return;
  end if;
  if (select count(*) from public.site_events
      where created_at > now() - interval '1 day') >= 5000 then
    return;
  end if;
  insert into public.site_events (label, lang)
  values (p_label, case when p_lang in ('nl', 'fr', 'en') then p_lang end);
end;
$$;
revoke all on function public.track_site_event(text, text) from public;
grant execute on function public.track_site_event(text, text) to anon, authenticated;

create function public.hq_site_stats()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_founder() then
    return null;
  end if;
  return jsonb_build_object(
    'buttons', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'last_30d', cur, 'prev_30d', prev)
                       order by cur desc, label)
      from (
        select label,
               count(*) filter (where created_at > now() - interval '30 days') as cur,
               count(*) filter (where created_at <= now() - interval '30 days') as prev
        from public.site_events
        where created_at > now() - interval '60 days'
        group by label
      ) b
    ), '[]'::jsonb),
    'languages', coalesce((
      select jsonb_object_agg(coalesce(lang, '?'), n)
      from (
        select lang, count(*) as n from public.site_events
        where created_at > now() - interval '30 days' group by lang
      ) l
    ), '{}'::jsonb),
    'demo_requests', jsonb_build_object(
      'last_30d', (select count(*) from public.leads
                   where created_at > now() - interval '30 days'),
      'prev_30d', (select count(*) from public.leads
                   where created_at between now() - interval '60 days' and now() - interval '30 days')),
    'try_runs', jsonb_build_object(
      'last_30d', (select count(*) from public.usage_events
                   where kind = 'demo' and created_at > now() - interval '30 days'),
      'prev_30d', (select count(*) from public.usage_events
                   where kind = 'demo'
                     and created_at between now() - interval '60 days' and now() - interval '30 days'))
  );
end;
$$;
revoke all on function public.hq_site_stats() from public;
grant execute on function public.hq_site_stats() to authenticated;

select cron.schedule(
  'delete-old-site-events',
  '47 3 * * *',
  $$delete from public.site_events where created_at < now() - interval '400 days'$$
);
