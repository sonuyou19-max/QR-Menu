-- Phase 1.2: restaurants, members, menu structure, translations, uploads (CLAUDE.md 6).
--
-- Access model (RLS on every table):
--   * Members (owner or staff) of a restaurant can read its rows.
--   * Only owners can create, change or delete menu content and restaurant settings.
--   * Restaurants are created through create_restaurant(), which also makes the caller the owner
--     (a plain INSERT could not pass RLS, because membership does not exist yet).
--   * Nothing is readable by the public (anon) here. Guests will read published menus through
--     the get-menu edge function / a dedicated view in step 7, never these tables directly.

-- Membership checks live in a schema the API does not expose, so they cannot be called directly.
create schema if not exists private;
grant usage on schema private to authenticated;

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name text not null check (char_length(name) between 1 and 120),
  address text check (char_length(address) <= 200),
  logo_path text,
  source_language text not null default 'nl' check (char_length(source_language) between 2 and 5),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  guest_languages text[] not null default '{en,fr,nl,de}',
  is_published boolean not null default false,
  theme jsonb not null default '{}'::jsonb,
  plan text not null default 'pilot' check (plan in ('pilot', 'monthly', 'annual')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index restaurant_members_user_id_idx on public.restaurant_members (user_id);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sort_order int not null default 0
);
create index menu_categories_restaurant_idx on public.menu_categories (restaurant_id, sort_order);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants on delete cascade,
  category_id uuid references public.menu_categories on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  price numeric(8, 2) check (price >= 0),
  menu_description text,
  typical_description text,
  show_typical_description boolean not null default true,
  confidence text check (confidence in ('known_dish', 'likely', 'unknown')),
  dietary jsonb not null default '{}'::jsonb,
  allergens text[] not null default '{}',
  allergen_status text not null default 'suggested'
    check (allergen_status in ('suggested', 'confirmed')),
  image_path text,
  image_thumb_path text,
  in_stock boolean not null default true,
  is_hidden boolean not null default false,
  sort_order int not null default 0,
  content_hash text,
  updated_at timestamptz not null default now()
);
create index menu_items_restaurant_idx on public.menu_items (restaurant_id, category_id, sort_order);
create index menu_items_category_idx on public.menu_items (category_id);

create table public.translations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants on delete cascade,
  entity_type text not null check (entity_type in ('item', 'category')),
  entity_id uuid not null,
  language text not null,
  name text,
  menu_description text,
  typical_description text,
  source_hash text,
  unique (entity_type, entity_id, language)
);
create index translations_restaurant_idx on public.translations (restaurant_id, language);

create table public.menu_uploads (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants on delete cascade,
  source_type text not null check (source_type in ('photo', 'pdf', 'url')),
  source_url text,
  file_paths text[],
  status text not null default 'processing'
    check (status in ('processing', 'needs_review', 'done', 'failed')),
  raw_result jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index menu_uploads_restaurant_idx on public.menu_uploads (restaurant_id, created_at desc);

-- Keep menu_items.updated_at current (used for change detection and "last edited" labels).
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger menu_items_touch_updated_at
  before update on public.menu_items
  for each row execute function private.touch_updated_at();

-- Is the current user a member (optionally: an owner) of this restaurant?
-- SECURITY DEFINER so policies on other tables can check membership without RLS recursion.
create function private.is_member(rid uuid, owner_only boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = rid
      and m.user_id = (select auth.uid())
      and (not owner_only or m.role = 'owner')
  );
$$;
revoke all on function private.is_member(uuid, boolean) from public;
grant execute on function private.is_member(uuid, boolean) to authenticated;

alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.translations enable row level security;
alter table public.menu_uploads enable row level security;

-- restaurants: members read, owners update. Created via create_restaurant(); no deletes yet.
create policy "members read their restaurant" on public.restaurants
  for select to authenticated using (private.is_member(id));
create policy "owners update their restaurant" on public.restaurants
  for update to authenticated using (private.is_member(id, true)) with check (private.is_member(id, true));

-- restaurant_members: you see your own memberships and your restaurant's team. Changes come later
-- (staff invites) through a dedicated function.
create policy "members read their team" on public.restaurant_members
  for select to authenticated using (user_id = (select auth.uid()) or private.is_member(restaurant_id));

-- Menu content: members read, owners write.
create policy "members read categories" on public.menu_categories
  for select to authenticated using (private.is_member(restaurant_id));
create policy "owners add categories" on public.menu_categories
  for insert to authenticated with check (private.is_member(restaurant_id, true));
create policy "owners change categories" on public.menu_categories
  for update to authenticated using (private.is_member(restaurant_id, true)) with check (private.is_member(restaurant_id, true));
create policy "owners delete categories" on public.menu_categories
  for delete to authenticated using (private.is_member(restaurant_id, true));

create policy "members read items" on public.menu_items
  for select to authenticated using (private.is_member(restaurant_id));
create policy "owners add items" on public.menu_items
  for insert to authenticated with check (private.is_member(restaurant_id, true));
create policy "owners change items" on public.menu_items
  for update to authenticated using (private.is_member(restaurant_id, true)) with check (private.is_member(restaurant_id, true));
create policy "owners delete items" on public.menu_items
  for delete to authenticated using (private.is_member(restaurant_id, true));

create policy "members read translations" on public.translations
  for select to authenticated using (private.is_member(restaurant_id));
create policy "owners add translations" on public.translations
  for insert to authenticated with check (private.is_member(restaurant_id, true));
create policy "owners change translations" on public.translations
  for update to authenticated using (private.is_member(restaurant_id, true)) with check (private.is_member(restaurant_id, true));
create policy "owners delete translations" on public.translations
  for delete to authenticated using (private.is_member(restaurant_id, true));

create policy "members read uploads" on public.menu_uploads
  for select to authenticated using (private.is_member(restaurant_id));
create policy "owners add uploads" on public.menu_uploads
  for insert to authenticated with check (private.is_member(restaurant_id, true));
create policy "owners change uploads" on public.menu_uploads
  for update to authenticated using (private.is_member(restaurant_id, true)) with check (private.is_member(restaurant_id, true));
create policy "owners delete uploads" on public.menu_uploads
  for delete to authenticated using (private.is_member(restaurant_id, true));

-- Guests never touch these tables directly.
revoke all on public.restaurants, public.restaurant_members, public.menu_categories,
  public.menu_items, public.translations, public.menu_uploads from anon;

-- Menu web addresses we keep for ourselves (marketing demo, future routes).
create function private.is_reserved_slug(s text) returns boolean
language sql immutable set search_path = '' as $$
  select s = any (array['demo', 'admin', 'api', 'app', 'login', 'logout', 'm', 'menu', 'menubuddy',
    'qr', 'service', 'settings', 'setup', 'support', 'test', 'upload', 'www']);
$$;

-- Can this menu web address still be used? (Owners cannot see other restaurants, so ask here.)
create function public.is_slug_available(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.is_reserved_slug(p_slug)
    and not exists (select 1 from public.restaurants r where r.slug = p_slug);
$$;
revoke all on function public.is_slug_available(text) from public, anon;
grant execute on function public.is_slug_available(text) to authenticated;

-- Create a restaurant and make the caller its owner, in one step.
create function public.create_restaurant(
  p_name text,
  p_slug text,
  p_address text,
  p_source_language text,
  p_guest_languages text[]
) returns public.restaurants
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  created public.restaurants;
begin
  if uid is null then
    raise exception 'not logged in' using errcode = '42501';
  end if;
  if private.is_reserved_slug(p_slug) then
    raise exception 'slug reserved' using errcode = '23505';
  end if;
  if (select count(*) from public.restaurant_members m where m.user_id = uid and m.role = 'owner') >= 5 then
    raise exception 'too many restaurants' using errcode = '54000';
  end if;

  insert into public.restaurants (name, slug, address, source_language, guest_languages)
  values (
    trim(p_name),
    p_slug,
    nullif(trim(coalesce(p_address, '')), ''),
    p_source_language,
    -- The menu's own language is always available to guests.
    array(select distinct unnest(p_guest_languages || p_source_language))
  )
  returning * into created;

  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (created.id, uid, 'owner');

  return created;
end;
$$;
revoke all on function public.create_restaurant(text, text, text, text, text[]) from public, anon;
grant execute on function public.create_restaurant(text, text, text, text, text[]) to authenticated;
