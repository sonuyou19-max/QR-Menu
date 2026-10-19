-- Phase 1.7: guest menu (CLAUDE.md 3, 4, 6, 7).
--
-- * get_menu(slug, language): everything the guest page needs in one call, and nothing more.
--   SECURITY DEFINER so guests (anon) never get table access: only published restaurants
--   (owners and staff may also preview their own unpublished menu), no hidden dishes, only
--   translations made from the current text (a stale one could describe an old dish), and
--   allergens only when the restaurant shows them and the owner confirmed them for that dish.
--   This is the "get-menu" of CLAUDE.md 7, done as a SQL function: one round trip, no cold start.
-- * Live updates for guests: when a dish's stock, price or visibility changes in a published
--   restaurant, a trigger broadcasts it on the public Realtime topic "menu:<slug>". Guests
--   subscribe to that topic only; menu tables stay closed to anon.

create function public.get_menu(p_slug text, p_language text default null)
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
revoke all on function public.get_menu(text, text) from public;
grant execute on function public.get_menu(text, text) to anon, authenticated;

create function private.broadcast_menu_item_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  menu_slug text;
begin
  select slug into menu_slug from public.restaurants
  where id = new.restaurant_id and is_published;
  if menu_slug is not null then
    perform realtime.send(
      jsonb_build_object(
        'id', new.id, 'in_stock', new.in_stock, 'price', new.price, 'is_hidden', new.is_hidden
      ),
      'item',
      'menu:' || menu_slug,
      false
    );
  end if;
  return null;
end;
$$;
create trigger menu_items_broadcast
  after update of in_stock, price, is_hidden on public.menu_items
  for each row
  when (old.in_stock is distinct from new.in_stock
    or old.price is distinct from new.price
    or old.is_hidden is distinct from new.is_hidden)
  execute function private.broadcast_menu_item_change();
