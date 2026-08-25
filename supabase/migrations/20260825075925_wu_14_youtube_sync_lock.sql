-- WU-14: allow exactly one YouTube synchronization run at a time.
create unique index youtube_sync_runs_one_running_idx
  on public.youtube_sync_runs ((status))
  where status = 'running';

create or replace function public.acquire_youtube_sync_run(
  p_trigger_kind text,
  p_started_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  -- A terminated serverless invocation cannot release a lock. Expire it on
  -- the next attempt so one failed invocation does not block future Cron runs.
  update public.youtube_sync_runs
  set
    status = 'failed',
    error_summary = 'expired_running_lock',
    finished_at = p_started_at
  where status = 'running'
    and started_at <= p_started_at - interval '15 minutes';

  begin
    insert into public.youtube_sync_runs (status, trigger_kind, started_at)
    values ('running', p_trigger_kind, p_started_at)
    returning id into v_run_id;
  exception
    when unique_violation then
      return null;
  end;

  return v_run_id;
end;
$$;

revoke all on function public.acquire_youtube_sync_run(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.acquire_youtube_sync_run(text, timestamptz)
  to service_role;

comment on function public.acquire_youtube_sync_run(text, timestamptz) is
  'Atomically expires a stale YouTube sync run and acquires the single running slot.';
