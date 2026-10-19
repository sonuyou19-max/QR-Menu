-- "Try with your own menu" on the marketing site (CLAUDE.md 4.6 Demo B, step 13).
--
-- * demo_runs: one row per preview. Only the demo-translate edge function (service role) reads
--   or writes it; the visitor gets the result through that function with a random token (only
--   its hash is stored here). The photos themselves are never stored: they go straight to the AI.
--   ip_hash only for the per-visitor limit.
-- * pg_cron deletes rows older than 24 hours, every hour.

create table public.demo_runs (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  ip_hash text,
  photo_count int not null check (photo_count between 1 and 3),
  target_language text not null,
  status text not null default 'processing'
    check (status in ('processing', 'done', 'failed')),
  error text,
  result jsonb,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);
create index demo_runs_created_idx on public.demo_runs (created_at);
create index demo_runs_ip_idx on public.demo_runs (ip_hash, created_at);

alter table public.demo_runs enable row level security;
revoke all on public.demo_runs from anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule(
  'delete-old-demo-runs',
  '17 * * * *',
  $$delete from public.demo_runs where created_at < now() - interval '24 hours'$$
);
