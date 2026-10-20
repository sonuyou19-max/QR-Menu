-- The demo restaurant (Brasserie Lindehof, marketing site's live demo) gets a named AI waiter,
-- so visitors see the feature: "Ask Lotte" / "Lotte · AI assistant" (owner's choice).
update public.restaurants set assistant_name = 'Lotte' where slug = 'demo';
