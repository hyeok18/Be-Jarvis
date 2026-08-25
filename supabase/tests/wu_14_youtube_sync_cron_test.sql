begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(12);

select has_function(
  'public',
  'acquire_youtube_sync_run',
  array['text', 'timestamp with time zone'],
  'the atomic YouTube sync lock function exists'
);

select ok(
  (
    select p.prosecdef
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'acquire_youtube_sync_run'
  ),
  'the lock function owns its server-only write boundary'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.acquire_youtube_sync_run(text,timestamptz)',
    'execute'
  ),
  'anonymous clients cannot acquire a sync lock'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.acquire_youtube_sync_run(text,timestamptz)',
    'execute'
  ),
  'authenticated clients cannot acquire a sync lock'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.acquire_youtube_sync_run(text,timestamptz)',
    'execute'
  ),
  'the server role can acquire a sync lock'
);

select has_index(
  'public',
  'youtube_sync_runs',
  'youtube_sync_runs_one_running_idx',
  'the database enforces one running sync'
);

create temporary table first_lock (run_id uuid not null);
insert into first_lock
select public.acquire_youtube_sync_run('cron', '2026-08-25 08:00:00+00');

select isnt(
  (select run_id from first_lock),
  null::uuid,
  'the first caller acquires the lock'
);

select is(
  (select status from public.youtube_sync_runs where id = (select run_id from first_lock)),
  'running',
  'the acquired run is recorded as running'
);

select is(
  public.acquire_youtube_sync_run('cron', '2026-08-25 08:01:00+00'),
  null::uuid,
  'a concurrent caller receives no lock'
);

update public.youtube_sync_runs
set started_at = '2026-08-25 07:30:00+00'
where id = (select run_id from first_lock);

create temporary table replacement_lock (run_id uuid not null);
insert into replacement_lock
select public.acquire_youtube_sync_run('cron', '2026-08-25 08:00:00+00');

select isnt(
  (select run_id from replacement_lock),
  null::uuid,
  'a caller replaces a lock older than fifteen minutes'
);

select is(
  (select status from public.youtube_sync_runs where id = (select run_id from first_lock)),
  'failed',
  'the expired run is preserved as failed history'
);

select is(
  (select count(*) from public.youtube_sync_runs where status = 'running'),
  1::bigint,
  'exactly one running sync remains after recovery'
);

select * from finish();
rollback;
