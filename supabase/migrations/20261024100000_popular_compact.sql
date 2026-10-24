-- Guest menu, inspired by a competitor review (owner's request): a "Popular" row at the top and
-- compact rows for categories such as drinks.
--
-- * menu_items.is_featured: the owner pins a dish to "Popular" (editor).
-- * menu_categories.compact: the owner shows a category as compact rows (name + price on one line,
--   small photo on the right); default off.
-- * get_menu returns category.compact and restaurant.popular: up to 6 dish ids, the owner's pinned
--   dishes first (menu order), then the dishes guests added to their order most in the last 30
--   days (at least 3 times). Only visible dishes of the published menu; the guest page leaves out
--   sold-out ones live. Everything else in get_menu is unchanged.

alter table public.menu_items add column is_featured boolean not null default false;
alter table public.menu_categories add column compact boolean not null default false;

create or replace function public.get_menu(p_slug text, p_language text default null::text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
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
      'assistant_name', r.assistant_name,
      'tagline_translated', (
        select t.name from public.translations t
        where t.entity_type = 'tagline' and t.entity_id = r.id and t.language = lang
          and t.source_hash = r.tagline_hash and lang <> r.source_language
      ),
      'popular', coalesce((
        select jsonb_agg(p.id order by p.rank)
        from (
          select id, rank from (
            select i.id, row_number() over (order by c.sort_order, i.sort_order) as rank
            from public.menu_items i
            join public.menu_categories c on c.id = i.category_id
            where i.restaurant_id = r.id and i.is_featured and not i.is_hidden
            union all
            select a.item_id, 1000 + row_number() over (order by a.n desc, a.item_id)
            from (
              select e.item_id, count(*) as n
              from public.guest_events e
              join public.menu_items i on i.id = e.item_id
              where e.restaurant_id = r.id and e.kind = 'add_to_cart'
                and e.created_at > now() - interval '30 days'
                and not i.is_hidden and not i.is_featured and i.category_id is not null
              group by e.item_id
              having count(*) >= 3
            ) a
          ) ranked
          order by rank
          limit 6
        ) p
      ), '[]'::jsonb)
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', c.id, 'name', c.name, 'translated_name', ct.name,
          'compact', c.compact, 'items', x.items)
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
$function$;
