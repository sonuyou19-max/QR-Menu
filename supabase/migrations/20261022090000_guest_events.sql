-- Step 15, part 1: anonymous guest events for the owner's insights (CLAUDE.md 3 owner flow 11).
--
-- * guest_events: what guests do on a published menu: open it (scan), change language, open a
--   dish, add a dish to the order, show the order to staff. No personal data: no IP, no session
--   id, no device; only the restaurant, the kind, the language, the dish and the table label.
--   Written only by the track-event edge function (service role); owners read their own rows.
-- * Kept 13 months (pg_cron, daily), enough for "this month vs last year's" later.

create table public.guest_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants on delete cascade,
  kind text not null
    check (kind in ('scan', 'view_item', 'language_switch', 'add_to_cart', 'show_to_staff')),
  language text check (language ~ '^[a-z]{2}$'),
  item_id uuid,
  table_label text check (char_length(table_label) between 1 and 20),
  created_at timestamptz not null default now()
);
create index guest_events_restaurant_idx on public.guest_events (restaurant_id, created_at);

alter table public.guest_events enable row level security;
revoke all on public.guest_events from anon, authenticated;
grant select on public.guest_events to authenticated;
create policy "owners read their guest events" on public.guest_events
  for select to authenticated using (private.is_member(restaurant_id, true));

select cron.schedule(
  'delete-old-guest-events',
  '41 3 * * *',
  $$delete from public.guest_events where created_at < now() - interval '400 days'$$
);
