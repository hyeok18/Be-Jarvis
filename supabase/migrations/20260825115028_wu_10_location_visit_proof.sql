-- WU-10: server-only location proof issuance and one-time reaction promotion.
-- Raw latitude/longitude/accuracy values are transient function arguments only.
-- They are deliberately absent from every stored row and return value.

create or replace function public.issue_location_visit_proof(
  p_user_id uuid,
  p_restaurant_id uuid,
  p_evidence_digest text,
  p_user_latitude double precision,
  p_user_longitude double precision,
  p_accuracy_meters double precision,
  p_checked_at timestamptz default now()
)
returns table (
  visit_proof_id uuid,
  is_valid boolean,
  reason_code text,
  expires_at timestamptz,
  verified_at timestamptz,
  config_version text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_valid boolean;
  v_reason_code text;
  v_expires_at timestamptz;
  v_config_version text;
  v_proof public.visit_proofs%rowtype;
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

  perform 1
  from auth.users
  where id = p_user_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'authenticated user does not exist';
  end if;

  select
    evaluation.is_valid,
    evaluation.reason_code,
    evaluation.expires_at,
    evaluation.config_version
  into strict
    v_is_valid,
    v_reason_code,
    v_expires_at,
    v_config_version
  from private.evaluate_location_checkin(
    p_restaurant_id,
    p_user_latitude,
    p_user_longitude,
    p_accuracy_meters,
    p_checked_at
  ) as evaluation;

  insert into public.visit_proofs (
    user_id,
    restaurant_id,
    method,
    status,
    evidence_digest,
    verified_at,
    expires_at,
    created_at
  )
  values (
    p_user_id,
    p_restaurant_id,
    'location_checkin',
    case when v_is_valid then 'verified' else 'rejected' end,
    p_evidence_digest,
    case when v_is_valid then p_checked_at else null end,
    coalesce(v_expires_at, p_checked_at),
    p_checked_at
  )
  returning * into v_proof;

  return query
  select
    v_proof.id,
    v_is_valid,
    v_reason_code,
    case when v_is_valid then v_proof.expires_at else null end,
    v_proof.verified_at,
    v_config_version;
end;
$$;

revoke all on function public.issue_location_visit_proof(
  uuid,
  uuid,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz
)
from public, anon, authenticated, service_role;
grant execute on function public.issue_location_visit_proof(
  uuid,
  uuid,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz
)
to service_role;

comment on function public.issue_location_visit_proof(
  uuid,
  uuid,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz
) is
  'Server-only location proof issuer. Coordinates and browser geolocation payloads are never stored or returned.';

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

  -- A currently counted reaction already owns a consumed proof. Changing its
  -- three-state selection preserves that validated state via the WU-09 command.
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
    risk_codes = '{}'::text[]
  where id = v_saved.reaction_id;

  select * into strict v_decision
  from private.decide_reaction_moderation(
    true,
    v_proof.method,
    null,
    '{}'::text[]
  );

  if v_decision.moderation_status <> 'counted' then
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

revoke all on function public.save_reaction_with_visit_proof(
  uuid,
  uuid,
  text,
  text,
  timestamptz
)
from public, anon, authenticated, service_role;
grant execute on function public.save_reaction_with_visit_proof(
  uuid,
  uuid,
  text,
  text,
  timestamptz
)
to service_role;

comment on function public.save_reaction_with_visit_proof(
  uuid,
  uuid,
  text,
  text,
  timestamptz
) is
  'Server-only atomic reaction promotion using a one-time location proof digest.';
