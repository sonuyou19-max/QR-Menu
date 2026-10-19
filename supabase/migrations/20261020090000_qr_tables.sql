-- Phase 1.7b: QR codes (CLAUDE.md 3 owner flow 8, 10 step 7b).
--
-- restaurants.qr_tables: the table names the owner made per-table QR codes for ("5", "Terras 2").
-- Each code opens /m/<slug>?t=<name>; the guest page shows the name (and later the "show to
-- staff" screen). Short labels without URL characters, at most 100 tables.

create function private.valid_table_labels(labels text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(labels) <= 100 and not exists (
    select 1 from unnest(labels) l
    where l is null or char_length(l) not between 1 and 20
      or l ~ '[[:cntrl:]?#&/\\%<>"+=]' or l <> btrim(l)
  );
$$;

alter table public.restaurants
  add column qr_tables text[] not null default '{}'
  constraint restaurants_qr_tables_valid check (private.valid_table_labels(qr_tables));
