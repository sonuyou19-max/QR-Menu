-- When process-menu last started on this upload: stops double runs (double AI cost) and lets the
-- app spot a run that died (still "processing" long after this time).
alter table public.menu_uploads add column processing_started_at timestamptz;
