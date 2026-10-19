-- Allergen display switch per restaurant (owner request).
-- Some restaurants don't want allergens on the guest menu. When false: guests and the chat see no
-- allergen information (only the standing "inform staff about allergies" note), and the editor
-- hides allergen confirmation. Per-dish allergens + allergen_status are kept as they are, so
-- switching back on only asks to confirm dishes that were never confirmed (or added since).
alter table public.restaurants add column show_allergens boolean not null default true;
