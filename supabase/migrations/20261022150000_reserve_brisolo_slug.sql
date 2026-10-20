-- The brand is now Brisolo (menubuddy.eu already exists in Benelux). Keep "brisolo" (and the
-- old "menubuddy") as menu web addresses no restaurant can take.
create or replace function private.is_reserved_slug(s text) returns boolean
language sql immutable set search_path = '' as $$
  select s = any (array['demo', 'admin', 'api', 'app', 'brisolo', 'hq', 'login', 'logout', 'm',
    'menu', 'menubuddy', 'qr', 'service', 'settings', 'setup', 'support', 'test', 'upload', 'www']);
$$;
