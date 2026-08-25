-- Remove only the legacy job-finder application schema.
-- Supabase-managed schemas such as auth and storage are intentionally preserved.
drop table if exists public.scraps;
drop table if exists public.jobs;
