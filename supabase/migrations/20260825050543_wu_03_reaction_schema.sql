-- WU-03: reaction-map schema, integrity rules, indexes, grants, and RLS.
-- Raw browser geolocation responses, user coordinates, receipt images, API keys,
-- YouTube payloads, transcripts, and comments are intentionally not modeled.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  kakao_place_id text not null unique,
  name text not null,
  category_name text not null,
  address_name text not null,
  road_address_name text,
  latitude double precision not null,
  longitude double precision not null,
  food_tags text[] not null default '{}',
  preference_profile jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_kakao_place_id_not_blank check (btrim(kakao_place_id) <> ''),
  constraint restaurants_name_not_blank check (btrim(name) <> ''),
  constraint restaurants_category_name_not_blank check (btrim(category_name) <> ''),
  constraint restaurants_address_name_not_blank check (btrim(address_name) <> ''),
  constraint restaurants_latitude_valid check (latitude between -90 and 90),
  constraint restaurants_longitude_valid check (longitude between -180 and 180),
  constraint restaurants_preference_profile_object
    check (jsonb_typeof(preference_profile) = 'object')
);

create table public.visit_proofs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  method text not null,
  status text not null,
  evidence_digest text not null unique,
  verified_at timestamptz,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint visit_proofs_identity unique (id, user_id, restaurant_id),
  constraint visit_proofs_method_valid
    check (method in ('location_checkin', 'merchant_qr', 'receipt', 'partner_transaction')),
  constraint visit_proofs_status_valid
    check (status in ('verified', 'expired', 'revoked', 'rejected')),
  constraint visit_proofs_evidence_digest_not_blank check (btrim(evidence_digest) <> ''),
  constraint visit_proofs_verified_state_valid check (
    status <> 'verified'
    or (verified_at is not null and expires_at > verified_at)
  ),
  constraint visit_proofs_used_after_creation check (used_at is null or used_at >= created_at)
);

create table public.restaurant_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  visit_proof_id uuid unique,
  kind text not null,
  moderation_status text not null default 'pending',
  risk_codes text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_reactions_user_restaurant_unique unique (user_id, restaurant_id),
  constraint restaurant_reactions_visit_proof_owner_fk
    foreign key (visit_proof_id, user_id, restaurant_id)
    references public.visit_proofs(id, user_id, restaurant_id)
    on delete restrict,
  constraint restaurant_reactions_kind_valid
    check (kind in ('like', 'okay', 'dislike')),
  constraint restaurant_reactions_moderation_status_valid
    check (moderation_status in ('pending', 'counted', 'held', 'rejected', 'private_only')),
  constraint restaurant_reactions_counted_requires_proof
    check (moderation_status <> 'counted' or (is_active and visit_proof_id is not null))
);

create table public.reaction_events (
  id bigint generated always as identity primary key,
  reaction_id uuid not null references public.restaurant_reactions(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  before_kind text,
  after_kind text,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint reaction_events_event_name_valid
    check (event_name in ('created', 'changed', 'held', 'counted', 'rejected', 'deleted')),
  constraint reaction_events_before_kind_valid
    check (before_kind is null or before_kind in ('like', 'okay', 'dislike')),
  constraint reaction_events_after_kind_valid
    check (after_kind is null or after_kind in ('like', 'okay', 'dislike')),
  constraint reaction_events_change_has_distinct_kinds check (
    event_name <> 'changed'
    or (before_kind is not null and after_kind is not null and before_kind <> after_kind)
  )
);

create table public.restaurant_reaction_summaries (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  like_count integer not null default 0 check (like_count >= 0),
  okay_count integer not null default 0 check (okay_count >= 0),
  dislike_count integer not null default 0 check (dislike_count >= 0),
  counted_total integer not null default 0 check (counted_total >= 0),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  constraint restaurant_reaction_summaries_total_valid
    check (counted_total = like_count + okay_count + dislike_count)
);

create table public.creator_channels (
  id uuid primary key default gen_random_uuid(),
  youtube_channel_id text not null unique,
  title text not null,
  thumbnail_url text,
  subscriber_count bigint,
  subscriber_count_hidden boolean not null default false,
  subscriber_count_fetched_at timestamptz,
  uploads_playlist_id text unique,
  is_allowlisted boolean not null default false,
  is_active boolean not null default true,
  metadata_fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_channels_youtube_id_not_blank check (btrim(youtube_channel_id) <> ''),
  constraint creator_channels_title_not_blank check (btrim(title) <> ''),
  constraint creator_channels_subscriber_count_valid
    check (subscriber_count is null or subscriber_count >= 0),
  constraint creator_channels_hidden_count_is_null
    check (not subscriber_count_hidden or subscriber_count is null)
);

create table public.creator_videos (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null unique,
  creator_channel_id uuid not null references public.creator_channels(id) on delete cascade,
  title text not null,
  description_excerpt text,
  thumbnail_url text,
  published_at timestamptz not null,
  privacy_status text not null,
  metadata_fetched_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_videos_youtube_id_not_blank check (btrim(youtube_video_id) <> ''),
  constraint creator_videos_title_not_blank check (btrim(title) <> ''),
  constraint creator_videos_description_excerpt_length
    check (description_excerpt is null or char_length(description_excerpt) <= 1000),
  constraint creator_videos_privacy_status_valid
    check (privacy_status in ('public', 'unlisted', 'private', 'deleted', 'unknown'))
);

create table public.creator_visit_evidence (
  id uuid primary key default gen_random_uuid(),
  creator_video_id uuid not null references public.creator_videos(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  status text not null default 'candidate',
  video_timestamp_seconds integer,
  confirmation_note text,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_visit_evidence_unique unique (creator_video_id, restaurant_id),
  constraint creator_visit_evidence_status_valid
    check (status in ('candidate', 'confirmed', 'rejected', 'stale')),
  constraint creator_visit_evidence_timestamp_valid
    check (video_timestamp_seconds is null or video_timestamp_seconds >= 0),
  constraint creator_visit_evidence_confirmed_state_valid check (
    status <> 'confirmed'
    or (confirmed_by is not null and confirmed_at is not null and last_verified_at is not null)
  )
);

create table public.youtube_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  trigger_kind text not null,
  api_request_count integer not null default 0 check (api_request_count >= 0),
  processed_video_count integer not null default 0 check (processed_video_count >= 0),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  error_summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint youtube_sync_runs_status_valid
    check (status in ('queued', 'running', 'succeeded', 'partial', 'failed')),
  constraint youtube_sync_runs_trigger_valid
    check (trigger_kind in ('manual', 'cron')),
  constraint youtube_sync_runs_error_summary_length
    check (error_summary is null or char_length(error_summary) <= 2000),
  constraint youtube_sync_runs_finished_state_valid check (
    (status in ('queued', 'running') and finished_at is null)
    or (status in ('succeeded', 'partial', 'failed') and finished_at is not null)
  )
);

-- Every foreign key and RLS ownership lookup has an index. Partial indexes serve
-- active/public projections without replacing the full foreign-key indexes.
create index restaurants_active_category_name_idx
  on public.restaurants (category_name, name)
  where is_active;

create index visit_proofs_user_restaurant_expires_idx
  on public.visit_proofs (user_id, restaurant_id, expires_at desc);
create index visit_proofs_restaurant_id_idx
  on public.visit_proofs (restaurant_id);

create index restaurant_reactions_restaurant_id_idx
  on public.restaurant_reactions (restaurant_id);
create index restaurant_reactions_active_moderation_idx
  on public.restaurant_reactions (restaurant_id, moderation_status)
  where is_active;
create index restaurant_reactions_counted_idx
  on public.restaurant_reactions (restaurant_id, kind)
  where is_active and moderation_status = 'counted';

create index reaction_events_reaction_created_idx
  on public.reaction_events (reaction_id, created_at desc);
create index reaction_events_actor_user_id_idx
  on public.reaction_events (actor_user_id);

create index creator_videos_creator_channel_id_idx
  on public.creator_videos (creator_channel_id);
create index creator_videos_active_channel_published_idx
  on public.creator_videos (creator_channel_id, published_at desc)
  where is_active;

create index creator_visit_evidence_restaurant_status_idx
  on public.creator_visit_evidence (restaurant_id, status);
create index creator_visit_evidence_confirmed_by_idx
  on public.creator_visit_evidence (confirmed_by);

create index youtube_sync_runs_status_started_idx
  on public.youtube_sync_runs (status, started_at desc);

-- Keep mutable models' timestamps consistent at the database boundary.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function private.set_updated_at();

create trigger restaurant_reactions_set_updated_at
before update on public.restaurant_reactions
for each row execute function private.set_updated_at();

create trigger creator_channels_set_updated_at
before update on public.creator_channels
for each row execute function private.set_updated_at();

create trigger creator_videos_set_updated_at
before update on public.creator_videos
for each row execute function private.set_updated_at();

create trigger creator_visit_evidence_set_updated_at
before update on public.creator_visit_evidence
for each row execute function private.set_updated_at();

-- reaction_events is append-only, including for the server application role.
create or replace function private.reject_reaction_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'reaction_events is append-only';
end;
$$;

revoke all on function private.reject_reaction_event_mutation() from public, anon, authenticated;

create trigger reaction_events_reject_mutation
before update or delete on public.reaction_events
for each row execute function private.reject_reaction_event_mutation();

-- RLS is enabled even on server-only tables so a later accidental GRANT does not
-- turn into public access. service_role remains the server/admin boundary.
alter table public.restaurants enable row level security;
alter table public.visit_proofs enable row level security;
alter table public.restaurant_reactions enable row level security;
alter table public.reaction_events enable row level security;
alter table public.restaurant_reaction_summaries enable row level security;
alter table public.creator_channels enable row level security;
alter table public.creator_videos enable row level security;
alter table public.creator_visit_evidence enable row level security;
alter table public.youtube_sync_runs enable row level security;

create policy restaurants_public_select
on public.restaurants
for select
to anon, authenticated
using (is_active);

create policy visit_proofs_owner_select
on public.visit_proofs
for select
to authenticated
using (user_id = (select auth.uid()));

create policy restaurant_reactions_owner_select
on public.restaurant_reactions
for select
to authenticated
using (user_id = (select auth.uid()));

create policy restaurant_reaction_summaries_public_select
on public.restaurant_reaction_summaries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.restaurants
    where restaurants.id = restaurant_reaction_summaries.restaurant_id
      and restaurants.is_active
  )
);

-- Start from no Data API access, then grant only the explicit P0 surface.
revoke all on table public.restaurants from public, anon, authenticated, service_role;
revoke all on table public.visit_proofs from public, anon, authenticated, service_role;
revoke all on table public.restaurant_reactions from public, anon, authenticated, service_role;
revoke all on table public.reaction_events from public, anon, authenticated, service_role;
revoke all on table public.restaurant_reaction_summaries from public, anon, authenticated, service_role;
revoke all on table public.creator_channels from public, anon, authenticated, service_role;
revoke all on table public.creator_videos from public, anon, authenticated, service_role;
revoke all on table public.creator_visit_evidence from public, anon, authenticated, service_role;
revoke all on table public.youtube_sync_runs from public, anon, authenticated, service_role;
revoke all on sequence public.reaction_events_id_seq from public, anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;

grant select (
  id,
  kakao_place_id,
  name,
  category_name,
  address_name,
  road_address_name,
  latitude,
  longitude,
  food_tags,
  is_active
) on public.restaurants to anon, authenticated;

grant select on public.restaurant_reaction_summaries to anon, authenticated;
grant select on public.visit_proofs to authenticated;
grant select on public.restaurant_reactions to authenticated;

grant all on table public.restaurants to service_role;
grant all on table public.visit_proofs to service_role;
grant all on table public.restaurant_reactions to service_role;
grant select, insert on table public.reaction_events to service_role;
grant all on table public.restaurant_reaction_summaries to service_role;
grant all on table public.creator_channels to service_role;
grant all on table public.creator_videos to service_role;
grant all on table public.creator_visit_evidence to service_role;
grant all on table public.youtube_sync_runs to service_role;
grant usage, select on sequence public.reaction_events_id_seq to service_role;

grant usage on schema private to service_role;
grant execute on function private.set_updated_at() to service_role;
grant execute on function private.reject_reaction_event_mutation() to service_role;

comment on table public.visit_proofs is
  'Derived visit tokens only; never store raw GPS coordinates, browser location payloads, or receipt images.';
comment on table public.restaurant_reaction_summaries is
  'Last known public projection; only active counted reactions may be materialized here.';
comment on table public.creator_visit_evidence is
  'Server-only candidates and decisions; expose only confirmed, fresh evidence through a safe server DTO.';
comment on table public.youtube_sync_runs is
  'Operational counters and bounded errors only; never store API keys or full YouTube payloads.';
