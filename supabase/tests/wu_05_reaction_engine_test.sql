begin;

create extension if not exists pgtap with schema extensions;

select plan(59);

select has_function(
  'private',
  'refresh_restaurant_reaction_summary',
  array['uuid'],
  'counted-only summary refresh function exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.refresh_restaurant_reaction_summary(uuid)',
    'execute'
  ),
  'anonymous clients cannot execute the private summary function'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.refresh_restaurant_reaction_summary(uuid)',
    'execute'
  ),
  'authenticated clients cannot execute the private summary function'
);

select ok(
  has_function_privilege(
    'service_role',
    'private.refresh_restaurant_reaction_summary(uuid)',
    'execute'
  ),
  'service role can execute the private summary function'
);

insert into auth.users (id, aud, role, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', false, false, now(), now()),
  ('90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', false, false, now(), now());

insert into public.restaurants (
  id,
  kakao_place_id,
  name,
  category_name,
  address_name,
  latitude,
  longitude
)
values (
  '90000000-0000-4000-8000-000000000101',
  'synthetic-wu05-summary-restaurant',
  '합성 WU-05 집계 식당',
  '테스트',
  '서울 성동구 합성 테스트길 5',
  37.55,
  127.05
);

select is(
  (
    select counted_total
    from private.refresh_restaurant_reaction_summary(
      '90000000-0000-4000-8000-000000000101'
    )
  ),
  0,
  'an empty restaurant refreshes to a zero public total'
);

insert into public.visit_proofs (
  id,
  user_id,
  restaurant_id,
  method,
  status,
  evidence_digest,
  verified_at,
  expires_at,
  used_at
)
values (
  '90000000-0000-4000-8000-000000000201',
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000101',
  'location_checkin',
  'verified',
  'synthetic-wu05-summary-proof',
  now() - interval '1 hour',
  now() + interval '23 hours',
  now()
);

insert into public.restaurant_reactions (
  id,
  user_id,
  restaurant_id,
  visit_proof_id,
  kind,
  moderation_status
)
values (
  '90000000-0000-4000-8000-000000000301',
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000101',
  '90000000-0000-4000-8000-000000000201',
  'like',
  'counted'
);

select results_eq(
  $$
    select like_count, okay_count, dislike_count, counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  $$,
  $$ values (1, 0, 0, 1) $$,
  'an inserted counted like is projected atomically'
);

insert into public.restaurant_reactions (
  id,
  user_id,
  restaurant_id,
  kind,
  moderation_status
)
values (
  '90000000-0000-4000-8000-000000000302',
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000101',
  'dislike',
  'pending'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  ),
  1,
  'pending reactions do not change the public total'
);

update public.restaurant_reactions
set moderation_status = 'held', risk_codes = array['REACTION_BURST']
where id = '90000000-0000-4000-8000-000000000302';

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  ),
  1,
  'held reactions do not change the public total'
);

update public.restaurant_reactions
set kind = 'okay'
where id = '90000000-0000-4000-8000-000000000301';

select results_eq(
  $$
    select like_count, okay_count, dislike_count, counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  $$,
  $$ values (0, 1, 0, 1) $$,
  'changing a counted reaction kind replaces rather than duplicates it'
);

update public.restaurant_reactions
set moderation_status = 'held'
where id = '90000000-0000-4000-8000-000000000301';

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  ),
  0,
  'moving a reaction to held removes it from the public projection'
);

select throws_ok(
  $$
    update public.restaurant_reactions
    set visit_proof_id = null, moderation_status = 'counted'
    where id = '90000000-0000-4000-8000-000000000301'
  $$,
  '23514',
  null,
  'a counted reaction without proof is rejected'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  ),
  0,
  'a failed mutation preserves the last valid public projection'
);

update public.restaurant_reactions
set moderation_status = 'counted'
where id = '90000000-0000-4000-8000-000000000301';

select results_eq(
  $$
    select like_count, okay_count, dislike_count, counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  $$,
  $$ values (0, 1, 0, 1) $$,
  'a valid retry refreshes the projection from source rows'
);

select ok(
  (
    select version > 1
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  ),
  'projection version advances across successful refreshes'
);

select throws_ok(
  $$
    select private.refresh_restaurant_reaction_summary(null)
  $$,
  '22004',
  'restaurant_id is required',
  'summary refresh rejects a missing restaurant id'
);

select throws_ok(
  $$
    select private.refresh_restaurant_reaction_summary(
      '90000000-0000-4000-8000-000000000999'
    )
  $$,
  '23503',
  'restaurant does not exist',
  'summary refresh rejects an unknown restaurant'
);

select results_eq(
  $$
    select
      version,
      location_maximum_distance_meters,
      location_maximum_accuracy_meters,
      visit_proof_validity_hours
    from private.reaction_engine_configs
    where is_active
  $$,
  $$ values ('p0-v1'::text, 120::double precision, 100::double precision, 24) $$,
  'P0 visit thresholds are stored as one active versioned config'
);

select is(
  private.haversine_distance_meters(37.55, 127.05, 37.55, 127.05),
  0::double precision,
  'haversine distance is zero for the same point'
);

select ok(
  (
    select is_valid
      and reason_code is null
      and distance_meters = 0
      and expires_at = timestamptz '2026-08-25 15:00:00+09' + interval '24 hours'
      and config_version = 'p0-v1'
    from private.evaluate_location_checkin(
      '90000000-0000-4000-8000-000000000101',
      37.55,
      127.05,
      100,
      timestamptz '2026-08-25 15:00:00+09'
    )
  ),
  'a boundary-accuracy nearby check-in receives a 24 hour eligibility result'
);

select is(
  (
    select reason_code
    from private.evaluate_location_checkin(
      '90000000-0000-4000-8000-000000000101',
      37.55,
      127.05,
      100.01,
      now()
    )
  ),
  'ACCURACY_INSUFFICIENT',
  'accuracy above 100 meters is rejected'
);

select is(
  (
    select reason_code
    from private.evaluate_location_checkin(
      '90000000-0000-4000-8000-000000000101',
      37.56,
      127.05,
      10,
      now()
    )
  ),
  'OUT_OF_RANGE',
  'a location well beyond 120 meters is rejected'
);

select is(
  (
    select reason_code
    from private.evaluate_location_checkin(
      '90000000-0000-4000-8000-000000000101',
      91,
      127.05,
      10,
      now()
    )
  ),
  'INVALID_LOCATION',
  'invalid latitude is rejected before distance calculation'
);

insert into public.visit_proofs (
  id,
  user_id,
  restaurant_id,
  method,
  status,
  evidence_digest,
  verified_at,
  expires_at,
  used_at,
  created_at
)
values
  ('90000000-0000-4000-8000-000000000202', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000101', 'location_checkin', 'verified', 'synthetic-wu05-unused-proof', now() - interval '1 hour', now() + interval '23 hours', null, now() - interval '1 hour'),
  ('90000000-0000-4000-8000-000000000203', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000101', 'location_checkin', 'expired', 'synthetic-wu05-expired-proof', now() - interval '25 hours', now() - interval '1 hour', null, now() - interval '25 hours'),
  ('90000000-0000-4000-8000-000000000204', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000101', 'location_checkin', 'revoked', 'synthetic-wu05-revoked-proof', now() - interval '1 hour', now() + interval '23 hours', null, now() - interval '1 hour'),
  ('90000000-0000-4000-8000-000000000205', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000101', 'location_checkin', 'verified', 'synthetic-wu05-mismatch-proof', now() - interval '1 hour', now() + interval '23 hours', null, now() - interval '1 hour'),
  ('90000000-0000-4000-8000-000000000206', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000101', 'location_checkin', 'verified', 'synthetic-wu05-time-expired-proof', now() - interval '25 hours', now() - interval '1 hour', null, now() - interval '25 hours');

select is(
  private.visit_proof_failure_reason(
    '90000000-0000-4000-8000-000000000202',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000101'
  ),
  null::text,
  'an unused matching verified proof is valid'
);

select is(
  private.visit_proof_failure_reason(
    '90000000-0000-4000-8000-000000000203',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000101'
  ),
  'VISIT_PROOF_NOT_VERIFIED',
  'an expired-status proof is not valid'
);

select is(
  private.visit_proof_failure_reason(
    '90000000-0000-4000-8000-000000000204',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000101'
  ),
  'VISIT_PROOF_NOT_VERIFIED',
  'a revoked proof is not valid'
);

select is(
  private.visit_proof_failure_reason(
    '90000000-0000-4000-8000-000000000206',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000101'
  ),
  'VISIT_PROOF_EXPIRED',
  'a verified proof beyond its expiry boundary is rejected'
);

select is(
  private.visit_proof_failure_reason(
    '90000000-0000-4000-8000-000000000205',
    '90000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000101'
  ),
  'VISIT_PROOF_MISMATCH',
  'proof ownership mismatch is rejected'
);

select is(
  private.visit_proof_failure_reason(
    '90000000-0000-4000-8000-000000000999',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000101'
  ),
  'MISSING_VISIT_PROOF',
  'a missing proof is rejected'
);

select is(
  private.consume_visit_proof(
    '90000000-0000-4000-8000-000000000202',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000101',
    now()
  ),
  'CONSUMED',
  'a valid proof is consumed atomically'
);

select ok(
  (
    select used_at is not null
    from public.visit_proofs
    where id = '90000000-0000-4000-8000-000000000202'
  ),
  'successful consumption stores only the derived used timestamp'
);

select is(
  private.consume_visit_proof(
    '90000000-0000-4000-8000-000000000202',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000101',
    now()
  ),
  'DUPLICATE_PROOF',
  'the same proof cannot be consumed twice'
);

select is(
  (
    select used_at
    from public.visit_proofs
    where id = '90000000-0000-4000-8000-000000000205'
  ),
  null::timestamptz,
  'a mismatched validation attempt does not mutate the proof'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema in ('public', 'private')
      and table_name in ('visit_proofs', 'reaction_engine_configs')
      and column_name in (
        'latitude',
        'longitude',
        'accuracy',
        'raw_location',
        'gps_payload'
      )
  ),
  0,
  'visit validation stores no raw user location fields'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.consume_visit_proof(uuid,uuid,uuid,timestamp with time zone)',
    'execute'
  ),
  'authenticated clients cannot consume proofs directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'private.consume_visit_proof(uuid,uuid,uuid,timestamp with time zone)',
    'execute'
  ),
  'service role can use proof consumption from a controlled server operation'
);

select results_eq(
  $$
    select moderation_status, reason_codes
    from private.decide_reaction_moderation(
      false,
      'location_checkin',
      null,
      '{}'
    )
  $$,
  $$ values ('rejected'::text, array['AUTH_REQUIRED']::text[]) $$,
  'unauthenticated public reactions are rejected'
);

select results_eq(
  $$
    select moderation_status, reason_codes
    from private.decide_reaction_moderation(true, 'none', 'MISSING_VISIT_PROOF', '{}')
  $$,
  $$ values ('private_only'::text, array['PRIVATE_PREFERENCE_ONLY']::text[]) $$,
  'a reaction without proof remains private only'
);

select results_eq(
  $$
    select moderation_status, reason_codes
    from private.decide_reaction_moderation(
      true,
      'location_checkin',
      'VISIT_PROOF_MISMATCH',
      '{}'
    )
  $$,
  $$ values ('rejected'::text, array['VISIT_PROOF_MISMATCH']::text[]) $$,
  'a proof ownership mismatch is rejected'
);

select results_eq(
  $$
    select moderation_status, reason_codes
    from private.decide_reaction_moderation(
      true,
      'location_checkin',
      'DUPLICATE_PROOF',
      '{}'
    )
  $$,
  $$ values ('rejected'::text, array['DUPLICATE_PROOF']::text[]) $$,
  'a duplicate proof is rejected'
);

select results_eq(
  $$
    select moderation_status, reason_codes
    from private.decide_reaction_moderation(
      true,
      'location_checkin',
      null,
      array['REACTION_BURST']
    )
  $$,
  $$ values ('held'::text, array['REACTION_BURST']::text[]) $$,
  'one behavioral risk signal holds rather than convicts the reaction'
);

select results_eq(
  $$
    select moderation_status, reason_codes
    from private.decide_reaction_moderation(
      true,
      'location_checkin',
      null,
      array['REACTION_BURST', 'DUPLICATE_PROOF']
    )
  $$,
  $$ values ('rejected'::text, array['DUPLICATE_PROOF']::text[]) $$,
  'a configured proof integrity rejection outranks a hold signal'
);

select results_eq(
  $$
    select moderation_status, reason_codes
    from private.decide_reaction_moderation(
      true,
      'location_checkin',
      null,
      '{}'
    )
  $$,
  $$ values ('counted'::text, '{}'::text[]) $$,
  'a clean valid visit is eligible for counted moderation'
);

select throws_ok(
  $$
    select *
    from private.decide_reaction_moderation(
      true,
      'location_checkin',
      null,
      array['UNKNOWN_SIGNAL']
    )
  $$,
  '22023',
  'unknown reaction risk code',
  'unknown risk codes fail closed'
);

select is(
  (
    select moderation_status
    from private.apply_reaction_moderation(
      '90000000-0000-4000-8000-000000000302',
      'rejected',
      array['VISIT_PROOF_MISMATCH'],
      '90000000-0000-4000-8000-000000000001',
      now()
    )
  ),
  'rejected',
  'held reactions can move to rejected with an integrity reason'
);

select results_eq(
  $$
    select event_name, reason_codes
    from public.reaction_events
    where reaction_id = '90000000-0000-4000-8000-000000000302'
    order by id desc
    limit 1
  $$,
  $$ values ('rejected'::text, array['VISIT_PROOF_MISMATCH']::text[]) $$,
  'rejection appends an explainable audit event'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  ),
  1,
  'rejecting a non-counted reaction leaves the projection unchanged'
);

insert into public.visit_proofs (
  id,
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
  '90000000-0000-4000-8000-000000000207',
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000101',
  'location_checkin',
  'verified',
  'synthetic-wu05-moderation-proof',
  now() - interval '1 hour',
  now() + interval '23 hours',
  now() - interval '1 hour'
);

update public.restaurant_reactions
set
  visit_proof_id = '90000000-0000-4000-8000-000000000207',
  moderation_status = 'held',
  risk_codes = array['REACTION_BURST']
where id = '90000000-0000-4000-8000-000000000302';

select is(
  (
    select moderation_status
    from private.apply_reaction_moderation(
      '90000000-0000-4000-8000-000000000302',
      'counted',
      '{}',
      '90000000-0000-4000-8000-000000000001',
      now()
    )
  ),
  'counted',
  'a held reaction can be cleared to counted with a valid proof'
);

select ok(
  (
    select used_at is not null
    from public.visit_proofs
    where id = '90000000-0000-4000-8000-000000000207'
  ),
  'counted moderation consumes the attached proof'
);

select results_eq(
  $$
    select like_count, okay_count, dislike_count, counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  $$,
  $$ values (0, 1, 1, 2) $$,
  'cleared moderation updates the counted-only projection'
);

select is(
  (
    select count(*)::integer
    from public.reaction_events
    where reaction_id = '90000000-0000-4000-8000-000000000302'
      and event_name = 'counted'
  ),
  1,
  'counted moderation appends one audit event'
);

select is(
  (
    select moderation_status
    from private.apply_reaction_moderation(
      '90000000-0000-4000-8000-000000000302',
      'held',
      array['REACTION_BURST'],
      '90000000-0000-4000-8000-000000000001',
      now()
    )
  ),
  'held',
  'a counted reaction can be held without deleting its raw row'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  ),
  1,
  'holding a counted reaction removes only that reaction from the projection'
);

select is(
  (
    select moderation_status
    from private.apply_reaction_moderation(
      '90000000-0000-4000-8000-000000000302',
      'counted',
      '{}',
      '90000000-0000-4000-8000-000000000001',
      now()
    )
  ),
  'counted',
  'a previously counted proof can restore its same reaction after review'
);

select throws_ok(
  $$
    select private.apply_reaction_moderation(
      '90000000-0000-4000-8000-000000000302',
      'pending',
      '{}',
      '90000000-0000-4000-8000-000000000001',
      now()
    )
  $$,
  '22023',
  'invalid moderation target',
  'unsupported moderation targets are rejected'
);

select throws_ok(
  $$
    select private.apply_reaction_moderation(
      '90000000-0000-4000-8000-000000000302',
      'held',
      '{}',
      '90000000-0000-4000-8000-000000000001',
      now()
    )
  $$,
  '22023',
  'held moderation requires hold reason codes',
  'held moderation cannot omit its explanation'
);

select throws_ok(
  $$
    select private.apply_reaction_moderation(
      '90000000-0000-4000-8000-000000000302',
      'held',
      array['REACTION_BURST'],
      '90000000-0000-4000-8000-000000000999',
      now()
    )
  $$,
  '23503',
  null,
  'an audit actor foreign-key failure rolls the moderation statement back'
);

select is(
  (
    select moderation_status
    from public.restaurant_reactions
    where id = '90000000-0000-4000-8000-000000000302'
  ),
  'counted',
  'failed audit insertion preserves the previous moderation status'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '90000000-0000-4000-8000-000000000101'
  ),
  2,
  'failed moderation preserves the last normal public projection'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.apply_reaction_moderation(uuid,text,text[],uuid,timestamp with time zone)',
    'execute'
  ),
  'authenticated clients cannot apply moderation directly'
);

select * from finish();

rollback;
