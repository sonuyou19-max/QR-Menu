-- The demo restaurant has no owner who can tap "Translate now", so its tagline translations
-- are set here (like the rest of its menu in 20261020190000_demo_restaurant).
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, source_hash)
select r.id, 'tagline', r.id, t.language, t.name, r.tagline_hash
from public.restaurants r
cross join (values
  ('en', 'Belgian classics in the heart of Leuven'),
  ('fr', 'Classiques belges au cœur de Louvain'),
  ('de', 'Belgische Klassiker im Herzen von Löwen'),
  ('es', 'Clásicos belgas en el corazón de Lovaina'),
  ('it', 'Classici belgi nel cuore di Lovanio'),
  ('zh', '鲁汶市中心的比利时经典菜')
) as t(language, name)
where r.slug = 'demo'
on conflict (entity_type, entity_id, language) do update
  set name = excluded.name, source_hash = excluded.source_hash;
