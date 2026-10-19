-- Phase 1.12: guest chat (menu-chat, CLAUDE.md 4.1). Every question and answer is logged so the
-- owner can review them later ("Guest questions", step 15) and flag wrong answers for the eval set.
--
-- * Guests never touch this table: the menu-chat edge function writes it with the service role.
-- * session_id: random id from the guest's sessionStorage (no account). ip_hash: salted hash of the
--   IP, only for rate limiting; never the IP itself.
-- * Owners read their own restaurant's rows and may only change flagged_by_owner.

create table public.chat_logs (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 64),
  ip_hash text,
  language text not null,
  question text not null,
  answer text not null,
  answer_type text not null
    check (answer_type in ('menu_fact', 'general_knowledge', 'cannot_answer', 'off_topic', 'error')),
  referenced_item_ids uuid[] not null default '{}',
  flagged_by_owner boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_logs_restaurant_time on public.chat_logs (restaurant_id, created_at desc);
create index chat_logs_session_time on public.chat_logs (session_id, created_at desc);
create index chat_logs_ip_time on public.chat_logs (ip_hash, created_at desc);

alter table public.chat_logs enable row level security;
revoke all on public.chat_logs from anon;

create policy "members read their chat logs" on public.chat_logs
  for select to authenticated using (private.is_member(restaurant_id, true));
create policy "owners flag answers" on public.chat_logs
  for update to authenticated
  using (private.is_member(restaurant_id, true))
  with check (private.is_member(restaurant_id, true));
revoke update on public.chat_logs from authenticated;
grant update (flagged_by_owner) on public.chat_logs to authenticated;
