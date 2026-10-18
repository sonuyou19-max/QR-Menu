-- HTTP calls from Postgres. Used for testing edge functions now and, with pg_cron,
-- for scheduled jobs later (e.g. deleting demo_runs older than 24h, CLAUDE.md 6).
create extension if not exists pg_net with schema extensions;
