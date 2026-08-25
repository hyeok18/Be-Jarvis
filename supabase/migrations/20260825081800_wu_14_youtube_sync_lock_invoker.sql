-- Forward-fix the already deployed WU-14 function so it uses only the
-- service role's existing table permissions and never elevates privileges.
alter function public.acquire_youtube_sync_run(text, timestamptz)
  security invoker;

revoke all on function public.acquire_youtube_sync_run(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.acquire_youtube_sync_run(text, timestamptz)
  to service_role;
