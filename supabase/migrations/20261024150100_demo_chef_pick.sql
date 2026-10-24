-- Demo menu: the chef recommends the stoofvlees.
update public.menu_items i
set is_chef_pick = true
from public.restaurants r
where r.id = i.restaurant_id and r.slug = 'demo' and i.name = 'Stoofvlees met frietjes';
