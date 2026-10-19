-- Phase 1.9a: each restaurant's own look (CLAUDE.md 4.4).
--
-- * restaurants.theme holds the look (template, fonts, colours, header, dish layout, headings,
--   ornament, texture, corners, tagline, cover photo); the app reads it defensively, the
--   database only keeps it a small object.
-- * Storage bucket `branding` (public read, like dish photos): logo and cover photo at
--   `<restaurant_id>/<random>.<ext>`; only owners write or delete.
-- * get_menu also returns the logo.
-- * similar_looks_nearby(restaurant): how many other restaurants in the same area (postcode, else
--   the last part of the address) have a look very close to this one. Counts only, never names:
--   the owner gets a nudge to stand out, nobody learns who the other restaurant is.

alter table public.restaurants
  add constraint restaurants_theme_small
  check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) <= 2048);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "owners upload branding" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and private.owns_upload_folder(name));
create policy "owners delete branding" on storage.objects
  for delete to authenticated
  using (bucket_id = 'branding' and private.owns_upload_folder(name));
-- Deleting through the Storage API also needs read access to the row.
create policy "owners read branding" on storage.objects
  for select to authenticated
  using (bucket_id = 'branding' and private.owns_upload_folder(name));

create or replace function public.get_menu(p_slug text, p_language text default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.restaurants;
  lang text;
begin
  select * into r from public.restaurants where slug = p_slug;
  if r.id is null or not (r.is_published or private.is_member(r.id)) then
    return null;
  end if;
  lang := case when p_language = any (r.guest_languages) then p_language else r.source_language end;

  return jsonb_build_object(
    'restaurant', jsonb_build_object(
      'name', r.name,
      'slug', r.slug,
      'currency', r.currency,
      'source_language', r.source_language,
      'languages', to_jsonb(r.guest_languages),
      'language', lang,
      'show_allergens', r.show_allergens,
      'theme', r.theme,
      'logo_path', r.logo_path,
      'is_published', r.is_published
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', c.id, 'name', c.name, 'translated_name', ct.name, 'items', x.items)
        order by c.sort_order
      )
      from public.menu_categories c
      left join public.translations ct
        on ct.entity_type = 'category' and ct.entity_id = c.id and ct.language = lang
        and ct.source_hash = c.content_hash and lang <> r.source_language
      cross join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'name', i.name,
            'translated_name', it.name,
            'price', i.price,
            'description', case
              when i.menu_description is not null then coalesce(it.menu_description, i.menu_description)
              when i.show_typical_description and i.typical_description is not null
                then coalesce(it.typical_description, i.typical_description)
            end,
            'description_is_typical',
              i.menu_description is null and i.show_typical_description
              and i.typical_description is not null,
            'confidence', i.confidence,
            'dietary', i.dietary,
            'allergens', case when r.show_allergens and i.allergen_status = 'confirmed'
              then to_jsonb(i.allergens) end,
            'allergens_confirmed', case when r.show_allergens
              then i.allergen_status = 'confirmed' end,
            'image_path', i.image_path,
            'thumb_path', i.image_thumb_path,
            'in_stock', i.in_stock
          )
          order by i.sort_order
        ) as items
        from public.menu_items i
        left join public.translations it
          on it.entity_type = 'item' and it.entity_id = i.id and it.language = lang
          and it.source_hash = i.content_hash and lang <> r.source_language
        where i.category_id = c.id and not i.is_hidden
      ) x
      where c.restaurant_id = r.id and x.items is not null
    ), '[]'::jsonb)
  );
end;
$$;

-- Belgian postcode in the address, else its last part ("…, Leuven" → "leuven").
create function private.address_area(addr text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(
    substring(addr from '\m([1-9][0-9]{3})\M'),
    nullif(lower(btrim(regexp_replace(addr, '^.*,', ''))), '')
  );
$$;

-- Distance between two #rrggbb colours (0 = same, ~441 = black vs white).
create function private.colour_distance(a text, b text) returns double precision
language sql immutable set search_path = '' as $$
  select case when a ~* '^#[0-9a-f]{6}$' and b ~* '^#[0-9a-f]{6}$' then sqrt(
    power(('x' || substr(a, 2, 2))::bit(8)::int - ('x' || substr(b, 2, 2))::bit(8)::int, 2) +
    power(('x' || substr(a, 4, 2))::bit(8)::int - ('x' || substr(b, 4, 2))::bit(8)::int, 2) +
    power(('x' || substr(a, 6, 2))::bit(8)::int - ('x' || substr(b, 6, 2))::bit(8)::int, 2)
  ) else 999 end;
$$;

-- Fonts and accent colour carry most of a look (3 points each), the background 1, and each
-- structural choice 1. 8 of 13 or more reads as "the same menu".
create function private.looks_alike(a jsonb, b jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select
    3 * (a ->> 'fonts' is not distinct from b ->> 'fonts')::int
    + 3 * (private.colour_distance(a ->> 'accent', b ->> 'accent') < 70)::int
    + (private.colour_distance(a ->> 'background', b ->> 'background') < 40)::int
    + (select count(*)::int from unnest(array['header', 'layout', 'headings', 'ornament',
        'texture', 'corners']) k where a ->> k is not distinct from b ->> k)
    >= 8;
$$;

create function public.similar_looks_nearby(p_restaurant uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.restaurants;
  area text;
begin
  if not private.is_member(p_restaurant, true) then
    return 0;
  end if;
  select * into me from public.restaurants where id = p_restaurant;
  area := private.address_area(me.address);
  if area is null or me.theme = '{}'::jsonb then
    return 0;
  end if;
  return (
    select count(*) from public.restaurants r
    where r.id <> me.id
      and r.theme <> '{}'::jsonb
      and private.address_area(r.address) = area
      and private.looks_alike(me.theme, r.theme)
  );
end;
$$;
revoke all on function public.similar_looks_nearby(uuid) from public, anon;
grant execute on function public.similar_looks_nearby(uuid) to authenticated;
