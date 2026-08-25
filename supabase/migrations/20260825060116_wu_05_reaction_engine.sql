-- WU-05 checkpoint 1: counted-only summary projection.
-- Functions stay in the unexposed private schema. The trigger makes every raw
-- reaction mutation and its public projection one short atomic transaction.

create or replace function private.refresh_restaurant_reaction_summary(
  p_restaurant_id uuid
)
returns public.restaurant_reaction_summaries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary public.restaurant_reaction_summaries%rowtype;
begin
  if p_restaurant_id is null then
    raise exception using
      errcode = '22004',
      message = 'restaurant_id is required';
  end if;

  -- Serialize projection refreshes per restaurant without locking unrelated
  -- restaurants. Transaction-scoped locks release automatically on rollback.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('reaction-summary:' || p_restaurant_id::text, 0)
  );

  perform 1
  from public.restaurants
  where id = p_restaurant_id
  for key share;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'restaurant does not exist';
  end if;

  insert into public.restaurant_reaction_summaries as current_summary (
    restaurant_id,
    like_count,
    okay_count,
    dislike_count,
    counted_total,
    version,
    updated_at
  )
  select
    p_restaurant_id,
    count(*) filter (where kind = 'like')::integer,
    count(*) filter (where kind = 'okay')::integer,
    count(*) filter (where kind = 'dislike')::integer,
    count(*)::integer,
    1,
    pg_catalog.clock_timestamp()
  from public.restaurant_reactions
  where restaurant_id = p_restaurant_id
    and is_active
    and moderation_status = 'counted'
  on conflict (restaurant_id) do update
  set
    like_count = excluded.like_count,
    okay_count = excluded.okay_count,
    dislike_count = excluded.dislike_count,
    counted_total = excluded.counted_total,
    version = current_summary.version + 1,
    updated_at = excluded.updated_at
  returning * into v_summary;

  return v_summary;
end;
$$;

revoke all on function private.refresh_restaurant_reaction_summary(uuid)
from public, anon, authenticated;
grant execute on function private.refresh_restaurant_reaction_summary(uuid)
to service_role;

create or replace function private.refresh_reaction_summary_from_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.refresh_restaurant_reaction_summary(new.restaurant_id);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform private.refresh_restaurant_reaction_summary(old.restaurant_id);
    return old;
  end if;

  if old.restaurant_id = new.restaurant_id then
    perform private.refresh_restaurant_reaction_summary(new.restaurant_id);
  elsif old.restaurant_id < new.restaurant_id then
    perform private.refresh_restaurant_reaction_summary(old.restaurant_id);
    perform private.refresh_restaurant_reaction_summary(new.restaurant_id);
  else
    perform private.refresh_restaurant_reaction_summary(new.restaurant_id);
    perform private.refresh_restaurant_reaction_summary(old.restaurant_id);
  end if;

  return new;
end;
$$;

revoke all on function private.refresh_reaction_summary_from_row()
from public, anon, authenticated, service_role;

create trigger restaurant_reactions_refresh_summary_after_insert
after insert on public.restaurant_reactions
for each row execute function private.refresh_reaction_summary_from_row();

create trigger restaurant_reactions_refresh_summary_after_delete
after delete on public.restaurant_reactions
for each row execute function private.refresh_reaction_summary_from_row();

create trigger restaurant_reactions_refresh_summary_after_update
after update of restaurant_id, kind, moderation_status, is_active
on public.restaurant_reactions
for each row
when (
  old.restaurant_id is distinct from new.restaurant_id
  or old.kind is distinct from new.kind
  or old.moderation_status is distinct from new.moderation_status
  or old.is_active is distinct from new.is_active
)
execute function private.refresh_reaction_summary_from_row();

-- Existing data receives one initial refresh. On a clean local reset this loop
-- is empty and seed inserts are handled by the trigger above.
do $$
declare
  v_restaurant_id uuid;
begin
  for v_restaurant_id in
    select id from public.restaurants order by id
  loop
    perform private.refresh_restaurant_reaction_summary(v_restaurant_id);
  end loop;
end;
$$;

-- WU-05 checkpoint 2: versioned visit validation without raw location storage.
create table private.reaction_engine_configs (
  version text primary key,
  location_maximum_distance_meters double precision not null,
  location_maximum_accuracy_meters double precision not null,
  visit_proof_validity_hours integer not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reaction_engine_configs_version_not_blank
    check (btrim(version) <> ''),
  constraint reaction_engine_configs_distance_positive
    check (location_maximum_distance_meters > 0),
  constraint reaction_engine_configs_accuracy_positive
    check (location_maximum_accuracy_meters > 0),
  constraint reaction_engine_configs_validity_positive
    check (visit_proof_validity_hours > 0)
);

create unique index reaction_engine_configs_one_active_idx
  on private.reaction_engine_configs (is_active)
  where is_active;

alter table private.reaction_engine_configs enable row level security;

revoke all on table private.reaction_engine_configs
from public, anon, authenticated, service_role;
grant select on table private.reaction_engine_configs to service_role;

create policy reaction_engine_configs_no_client_access
on private.reaction_engine_configs
for all
to anon, authenticated
using (false)
with check (false);

insert into private.reaction_engine_configs (
  version,
  location_maximum_distance_meters,
  location_maximum_accuracy_meters,
  visit_proof_validity_hours,
  is_active
)
values ('p0-v1', 120, 100, 24, true);

create or replace function private.haversine_distance_meters(
  p_latitude_a double precision,
  p_longitude_a double precision,
  p_latitude_b double precision,
  p_longitude_b double precision
)
returns double precision
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select 6371000.0 * 2.0 * pg_catalog.asin(
    pg_catalog.sqrt(
      least(
        1.0,
        pg_catalog.power(
          pg_catalog.sin(
            pg_catalog.radians(p_latitude_b - p_latitude_a) / 2.0
          ),
          2
        )
        + pg_catalog.cos(pg_catalog.radians(p_latitude_a))
        * pg_catalog.cos(pg_catalog.radians(p_latitude_b))
        * pg_catalog.power(
          pg_catalog.sin(
            pg_catalog.radians(p_longitude_b - p_longitude_a) / 2.0
          ),
          2
        )
      )
    )
  )
$$;

revoke all on function private.haversine_distance_meters(
  double precision,
  double precision,
  double precision,
  double precision
)
from public, anon, authenticated, service_role;

create or replace function private.evaluate_location_checkin(
  p_restaurant_id uuid,
  p_user_latitude double precision,
  p_user_longitude double precision,
  p_accuracy_meters double precision,
  p_checked_at timestamptz default now()
)
returns table (
  is_valid boolean,
  reason_code text,
  distance_meters double precision,
  expires_at timestamptz,
  config_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_config private.reaction_engine_configs%rowtype;
  v_distance double precision;
begin
  select * into v_restaurant
  from public.restaurants
  where id = p_restaurant_id
    and is_active;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'active restaurant does not exist';
  end if;

  select * into strict v_config
  from private.reaction_engine_configs
  where is_active;

  if p_checked_at is null
    or p_user_latitude is null
    or p_user_longitude is null
    or p_accuracy_meters is null
    or p_user_latitude not between -90 and 90
    or p_user_longitude not between -180 and 180
    or p_accuracy_meters < 0
  then
    return query select false, 'INVALID_LOCATION', null::double precision, null::timestamptz, v_config.version;
    return;
  end if;

  v_distance := private.haversine_distance_meters(
    p_user_latitude,
    p_user_longitude,
    v_restaurant.latitude,
    v_restaurant.longitude
  );

  if p_accuracy_meters > v_config.location_maximum_accuracy_meters then
    return query select false, 'ACCURACY_INSUFFICIENT', v_distance, null::timestamptz, v_config.version;
    return;
  end if;

  if v_distance > v_config.location_maximum_distance_meters then
    return query select false, 'OUT_OF_RANGE', v_distance, null::timestamptz, v_config.version;
    return;
  end if;

  return query
  select
    true,
    null::text,
    v_distance,
    p_checked_at + pg_catalog.make_interval(hours => v_config.visit_proof_validity_hours),
    v_config.version;
end;
$$;

revoke all on function private.evaluate_location_checkin(
  uuid,
  double precision,
  double precision,
  double precision,
  timestamptz
)
from public, anon, authenticated;
grant execute on function private.evaluate_location_checkin(
  uuid,
  double precision,
  double precision,
  double precision,
  timestamptz
)
to service_role;

create or replace function private.visit_proof_failure_reason(
  p_proof_id uuid,
  p_user_id uuid,
  p_restaurant_id uuid,
  p_checked_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proof public.visit_proofs%rowtype;
begin
  select * into v_proof
  from public.visit_proofs
  where id = p_proof_id;

  if not found then
    return 'MISSING_VISIT_PROOF';
  end if;

  if v_proof.user_id <> p_user_id or v_proof.restaurant_id <> p_restaurant_id then
    return 'VISIT_PROOF_MISMATCH';
  end if;

  if v_proof.status <> 'verified' then
    return 'VISIT_PROOF_NOT_VERIFIED';
  end if;

  if p_checked_at is null
    or v_proof.verified_at is null
    or p_checked_at < v_proof.verified_at
    or v_proof.expires_at <= p_checked_at
  then
    return 'VISIT_PROOF_EXPIRED';
  end if;

  if v_proof.used_at is not null then
    return 'DUPLICATE_PROOF';
  end if;

  return null;
end;
$$;

revoke all on function private.visit_proof_failure_reason(
  uuid,
  uuid,
  uuid,
  timestamptz
)
from public, anon, authenticated;
grant execute on function private.visit_proof_failure_reason(
  uuid,
  uuid,
  uuid,
  timestamptz
)
to service_role;

create or replace function private.consume_visit_proof(
  p_proof_id uuid,
  p_user_id uuid,
  p_restaurant_id uuid,
  p_consumed_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proof public.visit_proofs%rowtype;
  v_failure_reason text;
begin
  select * into v_proof
  from public.visit_proofs
  where id = p_proof_id
  for update;

  if not found then
    return 'MISSING_VISIT_PROOF';
  end if;

  v_failure_reason := private.visit_proof_failure_reason(
    p_proof_id,
    p_user_id,
    p_restaurant_id,
    p_consumed_at
  );

  if v_failure_reason is not null then
    return v_failure_reason;
  end if;

  update public.visit_proofs
  set used_at = p_consumed_at
  where id = p_proof_id;

  return 'CONSUMED';
end;
$$;

revoke all on function private.consume_visit_proof(
  uuid,
  uuid,
  uuid,
  timestamptz
)
from public, anon, authenticated;
grant execute on function private.consume_visit_proof(
  uuid,
  uuid,
  uuid,
  timestamptz
)
to service_role;
