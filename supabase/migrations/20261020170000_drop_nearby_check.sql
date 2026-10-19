-- The owner decided against comparing looks with nearby restaurants: remove the comparison
-- (similar_looks_nearby nudge on the Look screen, nearby_looks for suggest-theme) and the helpers
-- only it used. restaurants.theme, the branding bucket and get_menu's logo_path stay.

drop function if exists public.similar_looks_nearby(uuid);
drop function if exists public.nearby_looks(uuid);
drop function if exists private.looks_alike(jsonb, jsonb);
drop function if exists private.colour_distance(text, text);
drop function if exists private.address_area(text);
