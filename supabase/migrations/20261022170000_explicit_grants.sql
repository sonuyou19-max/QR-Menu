-- Explicit Data API grants for every table in "public".
--
-- From 30 October 2026 Supabase no longer grants anon/authenticated/service_role access to new
-- tables in "public" automatically. The live project keeps the grants it already has, but a
-- schema rebuilt from these migrations (new project, preview branch, `supabase db reset`) would
-- get none, and every owner screen, HQ and edge function would fail with "permission denied".
-- This migration states the grants the app relies on, so a rebuild matches production. On the
-- live project it changes nothing (all of these are already granted).
--
-- Grants follow the RLS policies: a role only gets the commands it has a policy for. anon gets
-- no table access at all; guests go through security-definer functions (get_menu, ...) and
-- edge functions. Every new table from now on needs its own grants in the migration that
-- creates it (CLAUDE.md section 6).

-- Owner/staff dashboard tables: members read and write their own restaurant's rows (RLS).
grant select, insert, update, delete
  on public.restaurants, public.restaurant_members, public.menu_categories,
     public.menu_items, public.translations, public.menu_uploads
  to authenticated;

-- Owners read their guests' questions and may only change the "wrong answer" flag
-- (column grant from 20261021090000_chat_logs stays the only update right).
grant select on public.chat_logs to authenticated;
grant update (flagged_by_owner) on public.chat_logs to authenticated;

-- Owners read their own analytics and AI usage.
grant select on public.guest_events, public.usage_events to authenticated;

-- leads and demo_runs: no grants for anon/authenticated (edge functions only).

-- Edge functions (service role) read and write every app table.
grant select, insert, update, delete
  on public.restaurants, public.restaurant_members, public.menu_categories,
     public.menu_items, public.translations, public.menu_uploads,
     public.chat_logs, public.guest_events, public.usage_events,
     public.leads, public.demo_runs
  to service_role;

-- Id sequences behind the bigserial tables, used by service-role inserts.
grant usage, select on sequence public.chat_logs_id_seq, public.guest_events_id_seq,
  public.usage_events_id_seq
  to service_role;
