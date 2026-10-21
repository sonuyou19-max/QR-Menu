-- Fix for 20261022160000_size_plans: the plan guard ran as the owner, who may not call
-- private.is_founder(), so every owner update of their restaurant failed. It now runs as its
-- owner (security definer) and only checks the founder when plan, plan_size or trial_ends_at
-- actually change.
create or replace function private.guard_restaurant_plan()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.plan, new.plan_size, new.trial_ends_at)
       is not distinct from (old.plan, old.plan_size, old.trial_ends_at) then
    return new;
  end if;
  if coalesce(auth.role(), '') = 'authenticated' and not private.is_founder() then
    raise exception 'plan can only be changed by Brisolo' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_restaurant_plan() from public, anon, authenticated;
