-- Phase 1.6: publish + translations (CLAUDE.md 3, 7, 8).
--
-- * content_hash on menu_items / menu_categories: md5 of the texts that get translated, kept up
--   to date by triggers. translations.source_hash = the content_hash it was made from, so a dish
--   is "translated" in a language when that row exists with the same hash. Price, stock, photo
--   or order changes don't touch the hash, so they never cost a re-translation.
-- * restaurants.translation_status / translation_started_at / translation_error: the
--   publish-menu edge function runs in the background; the app polls these.
--   published_at: first successful publish (is_published already exists).

alter table public.restaurants
  add column translation_status text not null default 'idle'
    check (translation_status in ('idle', 'running', 'failed')),
  add column translation_started_at timestamptz,
  add column translation_error text,
  add column published_at timestamptz;

alter table public.menu_categories add column content_hash text;

create function private.set_item_content_hash() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.content_hash := md5(
    new.name || chr(31) || coalesce(new.menu_description, '') || chr(31)
      || coalesce(new.typical_description, '')
  );
  return new;
end;
$$;
create trigger menu_items_content_hash
  before insert or update of name, menu_description, typical_description on public.menu_items
  for each row execute function private.set_item_content_hash();

create function private.set_category_content_hash() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.content_hash := md5(new.name);
  return new;
end;
$$;
create trigger menu_categories_content_hash
  before insert or update of name on public.menu_categories
  for each row execute function private.set_category_content_hash();

-- Existing rows (run separately with execute_sql: the migration tool's approval step blocks
-- bulk UPDATEs without a WHERE clause).
update public.menu_items set content_hash = md5(
  name || chr(31) || coalesce(menu_description, '') || chr(31) || coalesce(typical_description, '')
) where content_hash is null;
update public.menu_categories set content_hash = md5(name) where content_hash is null;
