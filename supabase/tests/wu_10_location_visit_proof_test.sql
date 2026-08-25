begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(33);

insert into auth.users (id, aud, role, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('92000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', false, false, now(), now()),
  ('92000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', false, false, now(), now());

insert into public.restaurants (
  id,
  kakao_place_id,
  name,
  category_name,
  address_name,
  latitude,
  longitude,
  is_active
)
values
  (
    '92000000-0000-4000-8000-000000000101',
    'synthetic-wu10-active-a',
    '합성 WU-10 식당 A',
    '테스트',
    '합성 주소 A',
    37.543,
    127.05,
    true
  ),
  (
    '92000000-0000-4000-8000-000000000102',
    'synthetic-wu10-active-b',
    '합성 WU-10 식당 B',
    '테스트',
    '합성 주소 B',
    37.553,
    127.06,
    true
  );

select has_function(
  'public',
  'issue_location_visit_proof',
  array['uuid', 'uuid', 'text', 'double precision', 'double precision', 'double precision', 'timestamp with time zone'],
  'the server location proof issuer exists'
);

select has_function(
  'public',
  'save_reaction_with_visit_proof',
  array['uuid', 'uuid', 'text', 'text', 'timestamp with time zone'],
  'the proof-aware reaction command exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.issue_location_visit_proof(uuid,uuid,text,double precision,double precision,double precision,timestamptz)',
    'execute'
  ),
  'anonymous clients cannot issue proofs'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.issue_location_visit_proof(uuid,uuid,text,double precision,double precision,double precision,timestamptz)',
    'execute'
  ),
  'authenticated clients cannot bypass the server proof route'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.issue_location_visit_proof(uuid,uuid,text,double precision,double precision,double precision,timestamptz)',
    'execute'
  ),
  'the service role can issue a proof after Auth verification'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_reaction_with_visit_proof(uuid,uuid,text,text,timestamptz)',
    'execute'
  ),
  'authenticated clients cannot promote their own reaction directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.save_reaction_with_visit_proof(uuid,uuid,text,text,timestamptz)',
    'execute'
  ),
  'the service role can execute the proof-aware reaction command'
);

select results_eq(
  $$
    select is_valid, reason_code, expires_at, verified_at, config_version
    from public.issue_location_visit_proof(
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000101',
      repeat('a', 64),
      37.543,
      127.05,
      100,
      '2026-08-25 10:00:00+00'
    )
  $$,
  $$ values (
    true,
    null::text,
    '2026-08-26 10:00:00+00'::timestamptz,
    '2026-08-25 10:00:00+00'::timestamptz,
    'p0-v1'::text
  ) $$,
  'an exact-position check-in accepts the 100m accuracy boundary for 24 hours'
);

select results_eq(
  $$
    select status, method, used_at
    from public.visit_proofs
    where evidence_digest = repeat('a', 64)
  $$,
  $$ values ('verified'::text, 'location_checkin'::text, null::timestamptz) $$,
  'the proof stores only derived verification state before use'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'visit_proofs'
      and column_name in (
        'latitude',
        'longitude',
        'accuracy',
        'location',
        'raw_location',
        'browser_position'
      )
  ),
  0,
  'visit proofs have no raw browser location field'
);

select results_eq(
  $$
    select is_valid, reason_code, expires_at, verified_at
    from public.issue_location_visit_proof(
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000101',
      repeat('b', 64),
      37.543,
      127.05,
      100.01,
      '2026-08-25 10:01:00+00'
    )
  $$,
  $$ values (false, 'ACCURACY_INSUFFICIENT'::text, null::timestamptz, null::timestamptz) $$,
  'accuracy above 100m is rejected without a usable token lifetime'
);

select results_eq(
  $$
    select status, verified_at, expires_at
    from public.visit_proofs
    where evidence_digest = repeat('b', 64)
  $$,
  $$ values ('rejected'::text, null::timestamptz, '2026-08-25 10:01:00+00'::timestamptz) $$,
  'a failed attempt stores only derived failure state and time'
);

select results_eq(
  $$
    select is_valid, reason_code
    from public.issue_location_visit_proof(
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000101',
      repeat('c', 64),
      37.553,
      127.06,
      10,
      '2026-08-25 10:02:00+00'
    )
  $$,
  $$ values (false, 'OUT_OF_RANGE'::text) $$,
  'a distant location is rejected'
);

select throws_ok(
  $$
    select *
    from public.issue_location_visit_proof(
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000101',
      'not-a-digest',
      37.543,
      127.05,
      10,
      now()
    )
  $$,
  '22023',
  'evidence digest must be a lowercase sha256 hex value',
  'the database rejects raw or malformed proof material'
);

select results_eq(
  $$
    select reaction_kind, moderation_status, was_created, was_changed
    from public.save_reaction_with_visit_proof(
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000101',
      'like',
      repeat('a', 64),
      '2026-08-25 10:05:00+00'
    )
  $$,
  $$ values ('like'::text, 'counted'::text, true, true) $$,
  'a valid one-time proof atomically promotes a selected reaction'
);

select isnt(
  (
    select used_at
    from public.visit_proofs
    where evidence_digest = repeat('a', 64)
  ),
  null::timestamptz,
  'the successful promotion consumes the proof'
);

select results_eq(
  $$
    select like_count, okay_count, dislike_count, counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '92000000-0000-4000-8000-000000000101'
  $$,
  $$ values (1, 0, 0, 1) $$,
  'only the proof-backed reaction enters the public distribution'
);

select throws_ok(
  $$
    select *
    from public.save_reaction_with_visit_proof(
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000101',
      'dislike',
      repeat('a', 64),
      '2026-08-25 10:06:00+00'
    )
  $$,
  '23514',
  'DUPLICATE_PROOF',
  'a consumed proof cannot be reused'
);

select results_eq(
  $$
    select kind, moderation_status
    from public.restaurant_reactions
    where user_id = '92000000-0000-4000-8000-000000000001'
      and restaurant_id = '92000000-0000-4000-8000-000000000101'
  $$,
  $$ values ('like'::text, 'counted'::text) $$,
  'a duplicate attempt rolls back the selection change'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '92000000-0000-4000-8000-000000000101'
  ),
  1,
  'a duplicate attempt leaves the last normal public projection intact'
);

select results_eq(
  $$
    select is_valid, expires_at
    from public.issue_location_visit_proof(
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000101',
      repeat('d', 64),
      37.543,
      127.05,
      10,
      '2026-08-24 10:00:00+00'
    )
  $$,
  $$ values (true, '2026-08-25 10:00:00+00'::timestamptz) $$,
  'the issuer records the deterministic 24-hour expiry boundary'
);

select throws_ok(
  $$
    select *
    from public.save_reaction_with_visit_proof(
      '92000000-0000-4000-8000-000000000002',
      '92000000-0000-4000-8000-000000000101',
      'okay',
      repeat('d', 64),
      '2026-08-25 10:00:00+00'
    )
  $$,
  '23514',
  'VISIT_PROOF_MISMATCH',
  'a proof cannot cross user ownership'
);

select throws_ok(
  $$
    select *
    from public.save_reaction_with_visit_proof(
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000102',
      'okay',
      repeat('d', 64),
      '2026-08-25 10:00:00+00'
    )
  $$,
  '23514',
  'VISIT_PROOF_MISMATCH',
  'a proof cannot cross restaurant ownership'
);

select throws_ok(
  $$
    select *
    from public.save_reaction_with_visit_proof(
      '92000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000101',
      'okay',
      repeat('d', 64),
      '2026-08-25 10:00:00+00'
    )
  $$,
  '23514',
  'VISIT_PROOF_EXPIRED',
  'the proof is expired exactly at its 24-hour boundary'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_reactions
    where user_id = '92000000-0000-4000-8000-000000000002'
  ),
  0,
  'a mismatched proof creates no reaction for the other user'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_reactions
    where restaurant_id = '92000000-0000-4000-8000-000000000102'
  ),
  0,
  'a mismatched proof creates no reaction for the other restaurant'
);

select results_eq(
  $$
    select reaction_kind, moderation_status
    from public.save_reaction_selection(
      '92000000-0000-4000-8000-000000000002',
      '92000000-0000-4000-8000-000000000102',
      'dislike'
    )
  $$,
  $$ values ('dislike'::text, 'private_only'::text) $$,
  'a reaction without proof remains private only'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '92000000-0000-4000-8000-000000000102'
  ),
  0,
  'a proofless reaction does not change the public distribution'
);

select throws_ok(
  $$
    select *
    from public.save_reaction_with_visit_proof(
      '92000000-0000-4000-8000-000000000002',
      '92000000-0000-4000-8000-000000000102',
      'dislike',
      repeat('f', 64),
      now()
    )
  $$,
  '23514',
  'MISSING_VISIT_PROOF',
  'an unknown token digest fails closed'
);

select is(
  (
    select count(*)::integer
    from public.reaction_events
    where reaction_id = (
      select id
      from public.restaurant_reactions
      where user_id = '92000000-0000-4000-8000-000000000001'
        and restaurant_id = '92000000-0000-4000-8000-000000000101'
    )
      and event_name = 'counted'
  ),
  1,
  'the successful public promotion has one append-only counted event'
);

select ok(
  (
    select evidence_digest ~ '^[0-9a-f]{64}$'
    from public.visit_proofs
    where evidence_digest = repeat('a', 64)
  ),
  'stored evidence is a one-way digest contract'
);

select is(
  (
    select count(*)::integer
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name in (
        'issue_location_visit_proof',
        'save_reaction_with_visit_proof'
      )
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ),
  0,
  'Data API clients have no direct execute grant on WU-10 commands'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema in ('public', 'private')
      and column_name in (
        'raw_latitude',
        'raw_longitude',
        'gps_payload',
        'geolocation_payload'
      )
  ),
  0,
  'WU-10 adds no raw coordinate or browser payload column anywhere'
);

select * from finish();

rollback;
