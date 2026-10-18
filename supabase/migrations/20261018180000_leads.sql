-- "Book a demo" requests from the marketing site (CLAUDE.md 4.6, 6).
-- Written only by the book-demo edge function (service role). RLS is on with no policies,
-- so the public anon/authenticated roles can neither read nor write this table.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  restaurant_name text check (char_length(restaurant_name) <= 120),
  city text check (char_length(city) <= 80),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  language text check (language in ('nl', 'fr', 'en')),
  preferred_time text check (char_length(preferred_time) <= 120),
  message text check (char_length(message) <= 2000),
  source text not null default 'book_demo' check (source in ('book_demo', 'try_your_menu')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'demo_done', 'pilot', 'won', 'lost')),
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;

-- Used by the function's per-email and daily rate limits.
create index leads_email_created_at_idx on public.leads (lower(email), created_at desc);
create index leads_created_at_idx on public.leads (created_at desc);
