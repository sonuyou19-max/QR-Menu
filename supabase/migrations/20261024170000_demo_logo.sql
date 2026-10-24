-- Demo restaurant: its logo (supabase/demo/), copied into the branding bucket by the edge function
-- seed-demo-branding. The demo has no members, so it changes only by migration.
update public.restaurants
set logo_path = id::text || '/lindehof-logo.png'
where slug = 'demo';
