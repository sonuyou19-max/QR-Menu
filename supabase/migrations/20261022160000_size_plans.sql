-- Plans by restaurant size (owner's decision): Small €29, Medium €49, Large €79 a month; annual
-- = 10 months (€290 / €490 / €790, "2 months free"); prices excl. VAT. The plan is chosen by seats;
-- menu visits are only a check.
--
-- * restaurants.plan_size: small | medium | large (default small). Set by the founder in HQ.
--   restaurants.plan keeps the billing: pilot (free) | monthly | annual.
-- * restaurants.seats: what the owner says (Settings); it suggests a plan, it doesn't set one.
-- * Owners can't change plan, plan_size or trial_ends_at themselves (trigger); the founder sets
--   them with hq_set_plan().
-- * private.plan_mrr(plan, size) is used instead of plan_mrr(plan); private.plan_visit_limit(size): about
--   1,000 menu visits a month for small, 3,000 for medium, none for large.
-- * hq_rows / hq_overview: plan_size, seats, visits of the 30 days before, above_plan, and a
--   "needs attention" group for restaurants above their plan two periods in a row.

alter table public.restaurants
  add column plan_size text not null default 'small' check (plan_size in ('small', 'medium', 'large')),
  add column seats int check (seats between 1 and 2000);

create function private.plan_mrr(p_plan text, p_size text)
returns numeric
language sql immutable set search_path = '' as $$
  select case p_plan
    when 'monthly' then case p_size when 'large' then 79 when 'medium' then 49 else 29 end
    when 'annual' then round(case p_size when 'large' then 790 when 'medium' then 490 else 290 end / 12.0, 2)
    else 0
  end::numeric;
$$;

create function private.plan_visit_limit(p_size text)
returns int
language sql immutable set search_path = '' as $$
  select case p_size when 'small' then 1000 when 'medium' then 3000 end;
$$;

-- Only the founder (or the service role) changes what a restaurant pays.
create function private.guard_restaurant_plan()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.plan, new.plan_size, new.trial_ends_at)
       is distinct from (old.plan, old.plan_size, old.trial_ends_at)
     and coalesce(auth.role(), '') = 'authenticated'
     and not private.is_founder() then
    raise exception 'plan can only be changed by Brisolo' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger restaurants_guard_plan before update on public.restaurants
  for each row execute function private.guard_restaurant_plan();

create function public.hq_set_plan(p_id uuid, p_plan text, p_size text)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_founder() then
    return false;
  end if;
  update public.restaurants set plan = p_plan, plan_size = p_size where id = p_id;
  return found;
end;
$$;
revoke all on function public.hq_set_plan(uuid, text, text) from public, anon;
grant execute on function public.hq_set_plan(uuid, text, text) to authenticated;

-- The old private.plan_mrr(text) stays unused (dropping it isn't needed).
revoke all on function private.plan_mrr(text, text), private.plan_visit_limit(text),
  private.guard_restaurant_plan() from public, anon, authenticated;
