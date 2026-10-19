-- Phase 1.10: the real `demo` restaurant (slug reserved since setup), shown on the marketing site
-- in place of its built-in sample. Same fictional brasserie and texts as site/src/data/sample-menu.ts
-- (generated from it). No members: nobody can edit it from the dashboard; change it with a migration.
-- Ids are derived from md5('menubuddy-demo:<key>') so this file is repeatable and readable.

insert into public.restaurants
  (id, slug, name, address, source_language, currency, guest_languages, is_published, published_at,
   show_allergens, theme)
values (
  md5('menubuddy-demo:restaurant')::uuid, 'demo', 'Brasserie Lindehof', 'Leuven', 'nl', 'EUR',
  array['nl', 'en', 'fr', 'de', 'es', 'it', 'zh'], true, now(), true,
  '{"template":"bistro","fonts":"bistro","accent":"#8c1c13","background":"#f6efe2","header":"band","layout":"list","headings":"centered","ornament":"monogram","texture":"paper","corners":"soft","tagline":"Belgische klassiekers in hartje Leuven","cover_path":null}'::jsonb
);

insert into public.menu_categories (id, restaurant_id, name, sort_order)
values (md5('menubuddy-demo:category:0')::uuid, md5('menubuddy-demo:restaurant')::uuid, 'Voorgerechten', 0);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'category', c.id, v.language, v.name, c.content_hash
from public.menu_categories c, (values ('en', 'Starters'), ('fr', 'Entrées'), ('de', 'Vorspeisen'), ('es', 'Entrantes'), ('it', 'Antipasti'), ('zh', '前菜')) v(language, name)
where c.id = md5('menubuddy-demo:category:0')::uuid;

insert into public.menu_items
  (id, restaurant_id, category_id, name, price, menu_description, confidence, dietary, allergens,
   allergen_status, in_stock, sort_order)
values (md5('menubuddy-demo:item:kaaskroketten')::uuid, md5('menubuddy-demo:restaurant')::uuid, md5('menubuddy-demo:category:0')::uuid, 'Kaaskroketten', 14, 'Twee krokante kroketten met gesmolten Belgische kaas, gefrituurde peterselie en citroen.', 'known_dish',
  '{"vegetarian":true,"vegan":false,"contains_pork":false,"contains_beef":false,"contains_alcohol":false,"spicy":false}'::jsonb,
  array['gluten', 'milk', 'eggs']::text[], 'confirmed', true, 0);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, menu_description, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'item', i.id, v.language, v.name, v.description, i.content_hash
from public.menu_items i, (values
  ('en', 'Cheese croquettes', 'Two crispy croquettes filled with molten Belgian cheese, with fried parsley and lemon.'),
  ('fr', 'Croquettes au fromage', 'Deux croquettes croustillantes au fromage belge fondant, persil frit et citron.'),
  ('de', 'Käsekroketten', 'Zwei knusprige Kroketten mit geschmolzenem belgischem Käse, frittierter Petersilie und Zitrone.'),
  ('es', 'Croquetas de queso', 'Dos croquetas crujientes rellenas de queso belga fundido, con perejil frito y limón.'),
  ('it', 'Crocchette di formaggio', 'Due crocchette croccanti ripiene di formaggio belga fuso, con prezzemolo fritto e limone.'),
  ('zh', '奶酪可乐饼', '两个酥脆可乐饼，内馅为融化的比利时奶酪，配炸欧芹和柠檬。')
) v(language, name, description)
where i.id = md5('menubuddy-demo:item:kaaskroketten')::uuid;

insert into public.menu_items
  (id, restaurant_id, category_id, name, price, menu_description, confidence, dietary, allergens,
   allergen_status, in_stock, sort_order)
values (md5('menubuddy-demo:item:garnaalkroketten')::uuid, md5('menubuddy-demo:restaurant')::uuid, md5('menubuddy-demo:category:0')::uuid, 'Garnaalkroketten', 18.5, 'Noordzeegarnalen in een romige vulling, gepaneerd en gefrituurd. Met citroen.', 'known_dish',
  '{"vegetarian":false,"vegan":false,"contains_pork":false,"contains_beef":false,"contains_alcohol":false,"spicy":false}'::jsonb,
  array['gluten', 'crustaceans', 'milk', 'eggs']::text[], 'confirmed', true, 1);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, menu_description, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'item', i.id, v.language, v.name, v.description, i.content_hash
from public.menu_items i, (values
  ('en', 'Grey shrimp croquettes', 'North Sea grey shrimp in a creamy filling, breaded and fried. Served with lemon.'),
  ('fr', 'Croquettes aux crevettes grises', 'Crevettes grises de la mer du Nord dans une farce crémeuse, panées et frites. Servies avec du citron.'),
  ('de', 'Nordseekrabben-Kroketten', 'Nordseekrabben in cremiger Füllung, paniert und frittiert. Mit Zitrone serviert.'),
  ('es', 'Croquetas de camarón gris', 'Camarón gris del mar del Norte en un relleno cremoso, empanado y frito. Con limón.'),
  ('it', 'Crocchette di gamberetti grigi', 'Gamberetti grigi del Mare del Nord in un ripieno cremoso, impanati e fritti. Serviti con limone.'),
  ('zh', '灰虾可乐饼', '北海灰虾配奶油馅，裹粉油炸，配柠檬。')
) v(language, name, description)
where i.id = md5('menubuddy-demo:item:garnaalkroketten')::uuid;

insert into public.menu_categories (id, restaurant_id, name, sort_order)
values (md5('menubuddy-demo:category:1')::uuid, md5('menubuddy-demo:restaurant')::uuid, 'Hoofdgerechten', 1);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'category', c.id, v.language, v.name, c.content_hash
from public.menu_categories c, (values ('en', 'Main courses'), ('fr', 'Plats principaux'), ('de', 'Hauptgerichte'), ('es', 'Platos principales'), ('it', 'Secondi piatti'), ('zh', '主菜')) v(language, name)
where c.id = md5('menubuddy-demo:category:1')::uuid;

insert into public.menu_items
  (id, restaurant_id, category_id, name, price, menu_description, confidence, dietary, allergens,
   allergen_status, in_stock, sort_order)
values (md5('menubuddy-demo:item:stoofvlees')::uuid, md5('menubuddy-demo:restaurant')::uuid, md5('menubuddy-demo:category:1')::uuid, 'Stoofvlees met frietjes', 22.5, 'Rundvlees, langzaam gestoofd in donker Belgisch bier met ui en mosterd.', 'known_dish',
  '{"vegetarian":false,"vegan":false,"contains_pork":false,"contains_beef":true,"contains_alcohol":true,"spicy":false}'::jsonb,
  array['gluten', 'mustard']::text[], 'confirmed', true, 0);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, menu_description, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'item', i.id, v.language, v.name, v.description, i.content_hash
from public.menu_items i, (values
  ('en', 'Flemish beef stew with fries', 'Beef slowly stewed in dark Belgian beer with onions and mustard.'),
  ('fr', 'Carbonnade flamande et frites', 'Bœuf mijoté lentement dans une bière belge brune, avec oignons et moutarde.'),
  ('de', 'Flämischer Rindereintopf mit Pommes', 'Rindfleisch, langsam in dunklem belgischem Bier mit Zwiebeln und Senf geschmort.'),
  ('es', 'Estofado flamenco de ternera con patatas fritas', 'Ternera guisada lentamente en cerveza belga oscura con cebolla y mostaza.'),
  ('it', 'Stufato fiammingo di manzo con patatine fritte', 'Manzo stufato lentamente nella birra scura belga con cipolle e senape.'),
  ('zh', '佛兰德啤酒炖牛肉配薯条', '牛肉用比利时黑啤酒、洋葱和芥末慢炖而成。')
) v(language, name, description)
where i.id = md5('menubuddy-demo:item:stoofvlees')::uuid;

insert into public.menu_items
  (id, restaurant_id, category_id, name, price, menu_description, confidence, dietary, allergens,
   allergen_status, in_stock, sort_order)
values (md5('menubuddy-demo:item:vol-au-vent')::uuid, md5('menubuddy-demo:restaurant')::uuid, md5('menubuddy-demo:category:1')::uuid, 'Vol-au-vent met frietjes', 21, 'Bladerdeeg met kip, balletjes en champignons in een romige saus.', 'known_dish',
  '{"vegetarian":false,"vegan":false,"contains_pork":false,"contains_beef":false,"contains_alcohol":false,"spicy":false}'::jsonb,
  array['gluten', 'milk', 'eggs', 'celery']::text[], 'confirmed', true, 1);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, menu_description, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'item', i.id, v.language, v.name, v.description, i.content_hash
from public.menu_items i, (values
  ('en', 'Chicken vol-au-vent with fries', 'Puff pastry with chicken, meatballs and mushrooms in a creamy sauce.'),
  ('fr', 'Vol-au-vent et frites', 'Feuilleté au poulet, boulettes et champignons en sauce crémeuse.'),
  ('de', 'Hühnerpastete mit Pommes', 'Blätterteig mit Huhn, Fleischbällchen und Champignons in Rahmsauce.'),
  ('es', 'Vol-au-vent de pollo con patatas fritas', 'Hojaldre con pollo, albóndigas y champiñones en salsa cremosa.'),
  ('it', 'Vol-au-vent di pollo con patatine fritte', 'Sfoglia con pollo, polpettine e funghi in salsa cremosa.'),
  ('zh', '鸡肉酥盒配薯条', '酥皮盒内盛鸡肉、肉丸和蘑菇，配奶油酱汁。')
) v(language, name, description)
where i.id = md5('menubuddy-demo:item:vol-au-vent')::uuid;

insert into public.menu_items
  (id, restaurant_id, category_id, name, price, menu_description, confidence, dietary, allergens,
   allergen_status, in_stock, sort_order)
values (md5('menubuddy-demo:item:waterzooi')::uuid, md5('menubuddy-demo:restaurant')::uuid, md5('menubuddy-demo:category:1')::uuid, 'Waterzooi van kip', 23, 'Kip en groenten in een lichte, romige bouillon.', 'known_dish',
  '{"vegetarian":false,"vegan":false,"contains_pork":false,"contains_beef":false,"contains_alcohol":false,"spicy":false}'::jsonb,
  array[]::text[], 'suggested', true, 2);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, menu_description, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'item', i.id, v.language, v.name, v.description, i.content_hash
from public.menu_items i, (values
  ('en', 'Ghent-style chicken stew', 'Chicken and vegetables in a light, creamy broth.'),
  ('fr', 'Waterzooi de poulet', 'Poulet et légumes dans un bouillon léger et crémeux.'),
  ('de', 'Genter Hühnereintopf', 'Huhn und Gemüse in einer leichten, cremigen Brühe.'),
  ('es', 'Guiso de pollo al estilo de Gante', 'Pollo y verduras en un caldo ligero y cremoso.'),
  ('it', 'Stufato di pollo alla gandese', 'Pollo e verdure in un brodo leggero e cremoso.'),
  ('zh', '根特式奶油炖鸡', '鸡肉和蔬菜配清淡的奶油高汤。')
) v(language, name, description)
where i.id = md5('menubuddy-demo:item:waterzooi')::uuid;

insert into public.menu_items
  (id, restaurant_id, category_id, name, price, menu_description, confidence, dietary, allergens,
   allergen_status, in_stock, sort_order)
values (md5('menubuddy-demo:item:mosselen')::uuid, md5('menubuddy-demo:restaurant')::uuid, md5('menubuddy-demo:category:1')::uuid, 'Mosselen natuur', 28, 'Een pot mosselen met selder en ui. Met frietjes.', 'known_dish',
  '{"vegetarian":false,"vegan":false,"contains_pork":false,"contains_beef":false,"contains_alcohol":false,"spicy":false}'::jsonb,
  array['molluscs', 'celery', 'sulphites']::text[], 'confirmed', false, 3);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, menu_description, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'item', i.id, v.language, v.name, v.description, i.content_hash
from public.menu_items i, (values
  ('en', 'Mussels, natural style', 'A pot of mussels steamed with celery and onion. Served with fries.'),
  ('fr', 'Moules nature', 'Une casserole de moules au céleri et à l''oignon. Servies avec des frites.'),
  ('de', 'Miesmuscheln natur', 'Ein Topf Muscheln, gedämpft mit Sellerie und Zwiebeln. Mit Pommes.'),
  ('es', 'Mejillones al natural', 'Una olla de mejillones al vapor con apio y cebolla. Con patatas fritas.'),
  ('it', 'Cozze al naturale', 'Una pentola di cozze al vapore con sedano e cipolla. Servite con patatine fritte.'),
  ('zh', '清蒸青口', '一锅用芹菜和洋葱蒸制的青口，配薯条。')
) v(language, name, description)
where i.id = md5('menubuddy-demo:item:mosselen')::uuid;

insert into public.menu_categories (id, restaurant_id, name, sort_order)
values (md5('menubuddy-demo:category:2')::uuid, md5('menubuddy-demo:restaurant')::uuid, 'Desserts', 2);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'category', c.id, v.language, v.name, c.content_hash
from public.menu_categories c, (values ('en', 'Desserts'), ('fr', 'Desserts'), ('de', 'Desserts'), ('es', 'Postres'), ('it', 'Dolci'), ('zh', '甜点')) v(language, name)
where c.id = md5('menubuddy-demo:category:2')::uuid;

insert into public.menu_items
  (id, restaurant_id, category_id, name, price, menu_description, confidence, dietary, allergens,
   allergen_status, in_stock, sort_order)
values (md5('menubuddy-demo:item:dame-blanche')::uuid, md5('menubuddy-demo:restaurant')::uuid, md5('menubuddy-demo:category:2')::uuid, 'Dame blanche', 9.5, 'Vanille-ijs, slagroom en warme Belgische chocoladesaus.', 'known_dish',
  '{"vegetarian":true,"vegan":false,"contains_pork":false,"contains_beef":false,"contains_alcohol":false,"spicy":false}'::jsonb,
  array['milk', 'eggs']::text[], 'confirmed', true, 0);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, menu_description, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'item', i.id, v.language, v.name, v.description, i.content_hash
from public.menu_items i, (values
  ('en', 'Vanilla ice cream with hot chocolate sauce', 'Vanilla ice cream, whipped cream and warm Belgian chocolate sauce.'),
  ('fr', 'Dame blanche', 'Glace vanille, crème fouettée et sauce chaude au chocolat belge.'),
  ('de', 'Vanilleeis mit heißer Schokoladensauce', 'Vanilleeis, Schlagsahne und warme belgische Schokoladensauce.'),
  ('es', 'Helado de vainilla con salsa de chocolate caliente', 'Helado de vainilla, nata montada y salsa caliente de chocolate belga.'),
  ('it', 'Gelato alla vaniglia con salsa di cioccolato calda', 'Gelato alla vaniglia, panna montata e salsa calda di cioccolato belga.'),
  ('zh', '香草冰淇淋配热巧克力酱', '香草冰淇淋、鲜奶油和温热的比利时巧克力酱。')
) v(language, name, description)
where i.id = md5('menubuddy-demo:item:dame-blanche')::uuid;

insert into public.menu_items
  (id, restaurant_id, category_id, name, price, menu_description, confidence, dietary, allergens,
   allergen_status, in_stock, sort_order)
values (md5('menubuddy-demo:item:chocolademousse')::uuid, md5('menubuddy-demo:restaurant')::uuid, md5('menubuddy-demo:category:2')::uuid, 'Chocolademousse', 8.5, 'Huisgemaakte mousse van pure Belgische chocolade.', 'known_dish',
  '{"vegetarian":true,"vegan":false,"contains_pork":false,"contains_beef":false,"contains_alcohol":false,"spicy":false}'::jsonb,
  array['milk', 'eggs']::text[], 'confirmed', true, 1);
insert into public.translations (restaurant_id, entity_type, entity_id, language, name, menu_description, source_hash)
select md5('menubuddy-demo:restaurant')::uuid, 'item', i.id, v.language, v.name, v.description, i.content_hash
from public.menu_items i, (values
  ('en', 'Chocolate mousse', 'Homemade mousse of dark Belgian chocolate.'),
  ('fr', 'Mousse au chocolat', 'Mousse maison au chocolat noir belge.'),
  ('de', 'Schokoladenmousse', 'Hausgemachte Mousse aus dunkler belgischer Schokolade.'),
  ('es', 'Mousse de chocolate', 'Mousse casera de chocolate negro belga.'),
  ('it', 'Mousse al cioccolato', 'Mousse fatta in casa di cioccolato fondente belga.'),
  ('zh', '巧克力慕斯', '自制比利时黑巧克力慕斯。')
) v(language, name, description)
where i.id = md5('menubuddy-demo:item:chocolademousse')::uuid;

