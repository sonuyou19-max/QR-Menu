-- The look's tagline gets translated for guests, like dish names (owner's decision).
--
-- * restaurants.tagline_hash: md5 of the trimmed tagline (generated), the tagline's
--   "content_hash". publish-menu translates it when no translation with this hash exists.
-- * translations.entity_type 'tagline': entity_id = the restaurant id, the text in `name`.
-- * get_menu returns restaurant.tagline_translated (null when missing, outdated, or the guest
--   reads the menu's own language: guests then see the tagline as written).

alter table public.restaurants
  add column tagline_hash text
    generated always as (md5(coalesce(btrim(theme ->> 'tagline'), ''))) stored;

alter table public.translations drop constraint translations_entity_type_check;
alter table public.translations add constraint translations_entity_type_check
  check (entity_type in ('item', 'category', 'tagline'));

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
      'is_published', r.is_published,
      'tagline_translated', (
        select t.name from public.translations t
        where t.entity_type = 'tagline' and t.entity_id = r.id and t.language = lang
          and t.source_hash = r.tagline_hash and lang <> r.source_language
      )
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
