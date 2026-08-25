-- WU-11: short-lived server-side abuse guard for reactions and location check-ins.
-- Network values are daily HMAC digests made in the Vercel server. Raw IP addresses,
-- stable device fingerprints, and browser geolocation payloads are never persisted.

create table private.abuse_guard_configs (
  version text primary key,
  is_active boolean not null default false,
  rate_limit_window interval not null default interval '1 hour',
  reaction_account_limit integer not null,
  reaction_network_limit integer not null,
  checkin_account_limit integer not null,
  checkin_network_limit integer not null,
  risk_signal_window interval not null default interval '10 minutes',
  reaction_burst_distinct_restaurants integer not null,
  account_cluster_distinct_users integer not null,
  impossible_travel_window interval not null default interval '20 minutes',
  impossible_travel_minimum_meters integer not null,
  retention_window interval not null default interval '7 days',
  created_at timestamptz not null default now(),
  constraint abuse_guard_configs_version_not_blank check (btrim(version) <> ''),
  constraint abuse_guard_configs_rate_window_positive check (rate_limit_window > interval '0'),
  constraint abuse_guard_configs_reaction_account_limit_positive check (reaction_account_limit > 0),
  constraint abuse_guard_configs_reaction_network_limit_positive check (reaction_network_limit > 0),
  constraint abuse_guard_configs_checkin_account_limit_positive check (checkin_account_limit > 0),
  constraint abuse_guard_configs_checkin_network_limit_positive check (checkin_network_limit > 0),
  constraint abuse_guard_configs_risk_signal_window_positive check (risk_signal_window > interval '0'),
  constraint abuse_guard_configs_burst_threshold_positive check (reaction_burst_distinct_restaurants > 1),
  constraint abuse_guard_configs_cluster_threshold_positive check (account_cluster_distinct_users > 1),
  constraint abuse_guard_configs_travel_window_positive check (impossible_travel_window > interval '0'),
  constraint abuse_guard_configs_travel_distance_positive check (impossible_travel_minimum_meters > 0),
  constraint abuse_guard_configs_retention_window_bounds
    check (retention_window > interval '0' and retention_window <= interval '7 days')
);

create unique index abuse_guard_configs_one_active_idx
  on private.abuse_guard_configs (is_active)
  where is_active;

create table private.abuse_rate_limit_buckets (
  action text not null,
  scope text not null,
  subject_key text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (action, scope, subject_key, window_started_at),
  constraint abuse_rate_limit_buckets_action_valid check (action in ('reaction', 'checkin')),
  constraint abuse_rate_limit_buckets_scope_valid check (scope in ('account', 'network')),
  constraint abuse_rate_limit_buckets_subject_key_valid check (
    (scope = 'account' and subject_key ~ '^account:[0-9a-f-]{36}$')
    or (scope = 'network' and subject_key ~ '^network:[0-9a-f]{64}$')
  ),
  constraint abuse_rate_limit_buckets_attempt_count_positive check (attempt_count > 0),
  constraint abuse_rate_limit_buckets_expiry_after_window check (expires_at > window_started_at)
);

create index abuse_rate_limit_buckets_expires_at_idx
  on private.abuse_rate_limit_buckets (expires_at);

create table private.abuse_guard_observations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  action text not null,
  network_hash text not null,
  risk_codes text[] not null default '{}'::text[],
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint abuse_guard_observations_action_valid check (action in ('reaction', 'checkin')),
  constraint abuse_guard_observations_network_hash_valid
    check (network_hash ~ '^[0-9a-f]{64}$'),
  constraint abuse_guard_observations_risk_codes_valid
    check (risk_codes <@ array['IMPOSSIBLE_TRAVEL', 'REACTION_BURST', 'ACCOUNT_CLUSTER']::text[]),
  constraint abuse_guard_observations_expiry_after_observed check (expires_at > observed_at)
);

create index abuse_guard_observations_user_action_recent_idx
  on private.abuse_guard_observations (user_id, action, observed_at desc);
create index abuse_guard_observations_network_restaurant_recent_idx
  on private.abuse_guard_observations (network_hash, restaurant_id, action, observed_at desc);
create index abuse_guard_observations_expires_at_idx
  on private.abuse_guard_observations (expires_at);

alter table private.abuse_guard_configs enable row level security;
alter table private.abuse_rate_limit_buckets enable row level security;
alter table private.abuse_guard_observations enable row level security;

revoke all on table private.abuse_guard_configs
from public, anon, authenticated, service_role;
revoke all on table private.abuse_rate_limit_buckets
from public, anon, authenticated, service_role;
revoke all on table private.abuse_guard_observations
from public, anon, authenticated, service_role;

grant all on table private.abuse_guard_configs to service_role;
grant all on table private.abuse_rate_limit_buckets to service_role;
grant all on table private.abuse_guard_observations to service_role;

create policy abuse_guard_configs_no_client_access
on private.abuse_guard_configs
for all
to authenticated
using (false)
with check (false);

create policy abuse_rate_limit_buckets_no_client_access
on private.abuse_rate_limit_buckets
for all
to authenticated
using (false)
with check (false);

create policy abuse_guard_observations_no_client_access
on private.abuse_guard_observations
for all
to authenticated
using (false)
with check (false);

insert into private.abuse_guard_configs (
  version,
  is_active,
  rate_limit_window,
  reaction_account_limit,
  reaction_network_limit,
  checkin_account_limit,
  checkin_network_limit,
  risk_signal_window,
  reaction_burst_distinct_restaurants,
  account_cluster_distinct_users,
  impossible_travel_window,
  impossible_travel_minimum_meters,
  retention_window
)
values (
  'p0-wu11-v1',
  true,
  interval '1 hour',
  12,
  30,
  8,
  16,
  interval '10 minutes',
  4,
  3,
  interval '20 minutes',
  50000,
  interval '7 days'
);

create or replace function public.enforce_reaction_abuse_guard(
  p_user_id uuid,
  p_restaurant_id uuid,
  p_action text,
  p_network_hash text,
  p_observed_at timestamptz default now()
)
returns table (
  is_allowed boolean,
  retry_after_seconds integer,
  risk_codes text[],
  config_version text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config private.abuse_guard_configs%rowtype;
  v_window_started_at timestamptz;
  v_account_limit integer;
  v_network_limit integer;
  v_account_attempt_count integer;
  v_network_attempt_count integer;
  v_observation_id bigint;
  v_risk_codes text[] := '{}'::text[];
  v_distinct_restaurants integer;
  v_distinct_users integer;
  v_has_impossible_travel boolean;
begin
  if p_user_id is null or p_restaurant_id is null or p_observed_at is null then
    raise exception using
      errcode = '22004',
      message = 'user_id, restaurant_id, and observed_at are required';
  end if;

  if p_action not in ('reaction', 'checkin') then
    raise exception using
      errcode = '22023',
      message = 'unsupported abuse guard action';
  end if;

  if p_network_hash is null or p_network_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'network hash must be a lowercase sha256 hex value';
  end if;

  perform 1 from auth.users where id = p_user_id;
  if not found then
    raise exception using errcode = '23503', message = 'authenticated user does not exist';
  end if;

  perform 1
  from public.restaurants
  where id = p_restaurant_id and is_active;
  if not found then
    raise exception using errcode = '23503', message = 'active restaurant does not exist';
  end if;

  select * into strict v_config
  from private.abuse_guard_configs
  where is_active;

  v_window_started_at := date_trunc('hour', p_observed_at);
  v_account_limit := case when p_action = 'reaction'
    then v_config.reaction_account_limit else v_config.checkin_account_limit end;
  v_network_limit := case when p_action = 'reaction'
    then v_config.reaction_network_limit else v_config.checkin_network_limit end;

  -- These keys serialize competing increments without retaining a raw network address.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'abuse-guard:' || p_action || ':' || p_user_id::text || ':' || p_network_hash,
      0
    )
  );

  delete from private.abuse_rate_limit_buckets
  where expires_at <= p_observed_at;
  delete from private.abuse_guard_observations
  where expires_at <= p_observed_at;

  insert into private.abuse_rate_limit_buckets (
    action, scope, subject_key, window_started_at, attempt_count, expires_at, updated_at
  ) values (
    p_action,
    'account',
    'account:' || p_user_id::text,
    v_window_started_at,
    1,
    v_window_started_at + v_config.retention_window,
    p_observed_at
  )
  on conflict (action, scope, subject_key, window_started_at)
  do update set
    attempt_count = private.abuse_rate_limit_buckets.attempt_count + 1,
    updated_at = excluded.updated_at
  returning attempt_count into v_account_attempt_count;

  insert into private.abuse_rate_limit_buckets (
    action, scope, subject_key, window_started_at, attempt_count, expires_at, updated_at
  ) values (
    p_action,
    'network',
    'network:' || p_network_hash,
    v_window_started_at,
    1,
    v_window_started_at + v_config.retention_window,
    p_observed_at
  )
  on conflict (action, scope, subject_key, window_started_at)
  do update set
    attempt_count = private.abuse_rate_limit_buckets.attempt_count + 1,
    updated_at = excluded.updated_at
  returning attempt_count into v_network_attempt_count;

  if v_account_attempt_count > v_account_limit
    or v_network_attempt_count > v_network_limit
  then
    return query
    select
      false,
      greatest(
        1,
        ceil(extract(epoch from (v_window_started_at + v_config.rate_limit_window - p_observed_at)))::integer
      ),
      array['RATE_LIMITED']::text[],
      v_config.version;
    return;
  end if;

  insert into private.abuse_guard_observations (
    user_id, restaurant_id, action, network_hash, risk_codes, observed_at, expires_at
  ) values (
    p_user_id,
    p_restaurant_id,
    p_action,
    p_network_hash,
    '{}'::text[],
    p_observed_at,
    p_observed_at + v_config.retention_window
  )
  returning id into v_observation_id;

  if p_action = 'reaction' then
    select count(distinct restaurant_id)::integer
    into v_distinct_restaurants
    from private.abuse_guard_observations
    where user_id = p_user_id
      and action = 'reaction'
      and observed_at >= p_observed_at - v_config.risk_signal_window;

    if v_distinct_restaurants >= v_config.reaction_burst_distinct_restaurants then
      v_risk_codes := array_append(v_risk_codes, 'REACTION_BURST');
    end if;

    select count(distinct user_id)::integer
    into v_distinct_users
    from private.abuse_guard_observations
    where network_hash = p_network_hash
      and restaurant_id = p_restaurant_id
      and action = 'reaction'
      and observed_at >= p_observed_at - v_config.risk_signal_window;

    if v_distinct_users >= v_config.account_cluster_distinct_users then
      v_risk_codes := array_append(v_risk_codes, 'ACCOUNT_CLUSTER');
    end if;

    select exists (
      select 1
      from public.visit_proofs as previous_proof
      join public.restaurants as previous_restaurant
        on previous_restaurant.id = previous_proof.restaurant_id
      join public.restaurants as target_restaurant
        on target_restaurant.id = p_restaurant_id
      where previous_proof.user_id = p_user_id
        and previous_proof.status = 'verified'
        and previous_proof.verified_at is not null
        and previous_proof.restaurant_id <> p_restaurant_id
        and previous_proof.verified_at >= p_observed_at - v_config.impossible_travel_window
        and (
          6371000 * 2 * asin(sqrt(
            power(sin(radians(target_restaurant.latitude - previous_restaurant.latitude) / 2), 2)
            + cos(radians(previous_restaurant.latitude))
              * cos(radians(target_restaurant.latitude))
              * power(sin(radians(target_restaurant.longitude - previous_restaurant.longitude) / 2), 2)
          ))
        ) >= v_config.impossible_travel_minimum_meters
    ) into v_has_impossible_travel;

    if v_has_impossible_travel then
      v_risk_codes := array_append(v_risk_codes, 'IMPOSSIBLE_TRAVEL');
    end if;
  end if;

  select coalesce(array_agg(distinct code order by code), '{}'::text[])
  into v_risk_codes
  from unnest(v_risk_codes) as code;

  update private.abuse_guard_observations
  set risk_codes = v_risk_codes
  where id = v_observation_id;

  return query select true, 0, v_risk_codes, v_config.version;
end;
$$;

revoke all on function public.enforce_reaction_abuse_guard(uuid, uuid, text, text, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.enforce_reaction_abuse_guard(uuid, uuid, text, text, timestamptz)
to service_role;

comment on function public.enforce_reaction_abuse_guard(uuid, uuid, text, text, timestamptz) is
  'Server-only account and daily network-HMAC rate guard. It never receives or persists a raw IP address.';

-- Preserve WU-10's public signature so clients and its migration test stay compatible.
-- The latest short-lived observation supplies only the server-calculated hold codes.
create or replace function public.save_reaction_with_visit_proof(
  p_user_id uuid,
  p_restaurant_id uuid,
  p_kind text,
  p_evidence_digest text,
  p_checked_at timestamptz default now()
)
returns table (
  reaction_id uuid,
  reaction_kind text,
  moderation_status text,
  was_created boolean,
  was_changed boolean,
  saved_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proof public.visit_proofs%rowtype;
  v_failure_reason text;
  v_saved record;
  v_decision record;
  v_moderated public.restaurant_reactions%rowtype;
  v_config private.abuse_guard_configs%rowtype;
  v_risk_codes text[] := '{}'::text[];
begin
  if p_user_id is null or p_restaurant_id is null or p_checked_at is null then
    raise exception using
      errcode = '22004',
      message = 'user_id, restaurant_id, and checked_at are required';
  end if;

  if p_evidence_digest is null
    or p_evidence_digest !~ '^[0-9a-f]{64}$'
  then
    raise exception using
      errcode = '22023',
      message = 'evidence digest must be a lowercase sha256 hex value';
  end if;

  select * into strict v_config
  from private.abuse_guard_configs
  where is_active;

  select risk_codes into v_risk_codes
  from private.abuse_guard_observations
  where user_id = p_user_id
    and restaurant_id = p_restaurant_id
    and action = 'reaction'
    and observed_at >= p_checked_at - v_config.risk_signal_window
  order by observed_at desc, id desc
  limit 1;

  v_risk_codes := coalesce(v_risk_codes, '{}'::text[]);

  select * into v_proof
  from public.visit_proofs
  where evidence_digest = p_evidence_digest
  for update;

  v_failure_reason := private.visit_proof_failure_reason(
    v_proof.id,
    p_user_id,
    p_restaurant_id,
    p_checked_at
  );

  if v_failure_reason is not null then
    raise exception using
      errcode = '23514',
      message = v_failure_reason;
  end if;

  select * into strict v_saved
  from public.save_reaction_selection(
    p_user_id,
    p_restaurant_id,
    p_kind
  );

  if v_saved.moderation_status = 'counted' then
    return query
    select
      v_saved.reaction_id,
      v_saved.reaction_kind,
      v_saved.moderation_status,
      v_saved.was_created,
      v_saved.was_changed,
      v_saved.saved_at;
    return;
  end if;

  if v_saved.moderation_status <> 'private_only' then
    raise exception using
      errcode = '23514',
      message = 'REACTION_NOT_ELIGIBLE';
  end if;

  update public.restaurant_reactions
  set
    visit_proof_id = v_proof.id,
    moderation_status = 'pending',
    risk_codes = v_risk_codes
  where id = v_saved.reaction_id;

  select * into strict v_decision
  from private.decide_reaction_moderation(
    true,
    v_proof.method,
    null,
    v_risk_codes
  );

  if v_decision.moderation_status not in ('counted', 'held') then
    raise exception using
      errcode = '23514',
      message = 'VISIT_PROOF_NOT_COUNTABLE';
  end if;

  v_moderated := private.apply_reaction_moderation(
    v_saved.reaction_id,
    v_decision.moderation_status,
    v_decision.reason_codes,
    p_user_id,
    p_checked_at
  );

  return query
  select
    v_moderated.id,
    v_moderated.kind,
    v_moderated.moderation_status,
    v_saved.was_created,
    v_saved.was_changed,
    v_moderated.updated_at;
end;
$$;

revoke all on function public.save_reaction_with_visit_proof(uuid, uuid, text, text, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.save_reaction_with_visit_proof(uuid, uuid, text, text, timestamptz)
to service_role;

comment on function public.save_reaction_with_visit_proof(uuid, uuid, text, text, timestamptz) is
  'Server-only atomic promotion. A current WU-11 risk observation can route a valid proof-backed reaction to held without changing public summaries.';
