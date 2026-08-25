-- Cover the composite visit-proof ownership foreign key for parent-row changes.
create index restaurant_reactions_visit_proof_owner_idx
  on public.restaurant_reactions (visit_proof_id, user_id, restaurant_id);

-- These tables are intentionally server-only. Explicit false policies document
-- the client boundary while service_role continues to bypass RLS.
create policy reaction_events_no_client_access
on public.reaction_events
for all
to anon, authenticated
using (false)
with check (false);

create policy creator_channels_no_client_access
on public.creator_channels
for all
to anon, authenticated
using (false)
with check (false);

create policy creator_videos_no_client_access
on public.creator_videos
for all
to anon, authenticated
using (false)
with check (false);

create policy creator_visit_evidence_no_client_access
on public.creator_visit_evidence
for all
to anon, authenticated
using (false)
with check (false);

create policy youtube_sync_runs_no_client_access
on public.youtube_sync_runs
for all
to anon, authenticated
using (false)
with check (false);
