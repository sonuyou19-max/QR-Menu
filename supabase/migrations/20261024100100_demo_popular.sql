-- Demo restaurant (Brasserie Lindehof): three dishes pinned to "Popular", so the website demo
-- shows the row. The demo has no members, so it changes only by migration.
update public.menu_items i set is_featured = true
from public.restaurants r
where r.id = i.restaurant_id and r.slug = 'demo'
  and i.name in ('Garnaalkroketten', 'Stoofvlees met frietjes', 'Dame blanche');
