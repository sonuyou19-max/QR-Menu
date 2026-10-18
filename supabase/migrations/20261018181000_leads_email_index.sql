-- book-demo stores emails lowercased and filters with `email = $1`, so index the plain column.
-- (The lower(email) index from the first migration is left in place; it is unused but harmless.)
create index leads_email_idx on public.leads (email, created_at desc);
