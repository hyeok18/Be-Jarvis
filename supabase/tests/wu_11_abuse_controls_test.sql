create extension if not exists pgtap with schema extensions;
set local search_path = public, private, extensions, pg_catalog;

select plan(18);

insert into auth.users (id, aud, role, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('93000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', false, false, now(), now()),
  ('93000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', false, false, now(), now()),
  ('93000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', false, false, now(), now()),
  ('93000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', false, false, now(), now()),
  ('93000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', false, false, now(), now()),
  ('93000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', false, false, now(), now());

insert into public.restaurants (
  id, kakao_place_id, name, category_name, address_name, latitude, longitude, is_active
)
values
  ('93000000-0000-4000-8000-000000000101', 'synthetic-wu11-a', '합성 WU-11 식당 A', '테스트', '합성 주소 A', 37.543, 127.050, true),
  ('93000000-0000-4000-8000-000000000102', 'synthetic-wu11-b', '합성 WU-11 식당 B', '테스트', '합성 주소 B', 37.553, 127.060, true),
  ('93000000-0000-4000-8000-000000000103', 'synthetic-wu11-c', '합성 WU-11 식당 C', '테스트', '합성 주소 C', 37.563, 127.070, true),
  ('93000000-0000-4000-8000-000000000104', 'synthetic-wu11-d', '합성 WU-11 식당 D', '테스트', '합성 주소 D', 37.573, 127.080, true),
  ('93000000-0000-4000-8000-000000000105', 'synthetic-wu11-far', '합성 WU-11 먼 식당', '테스트', '합성 주소 E', 40.7128, -74.0060, true);

select has_table('private', 'abuse_guard_configs', 'the private abuse config table exists');
select has_table('private', 'abuse_rate_limit_buckets', 'the private rate bucket table exists');
select has_table('private', 'abuse_guard_observations', 'the private observation table exists');

select has_function(
  'public',
  'enforce_reaction_abuse_guard',
  array['uuid', 'uuid', 'text', 'text', 'timestamp with time zone'],
  'the server-only abuse guard command exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.enforce_reaction_abuse_guard(uuid,uuid,text,text,timestamptz)',
    'execute'
  ),
  'anonymous clients cannot call the abuse guard directly'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.enforce_reaction_abuse_guard(uuid,uuid,text,text,timestamptz)',
    'execute'
  ),
  'authenticated clients cannot bypass the server abuse guard'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.enforce_reaction_abuse_guard(uuid,uuid,text,text,timestamptz)',
    'execute'
  ),
  'the server service role can call the abuse guard'
);

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname = 'private'
      and tablename in (
        'abuse_guard_configs',
        'abuse_rate_limit_buckets',
        'abuse_guard_observations'
      )
      and rowsecurity
  ),
  3,
  'every WU-11 private table has RLS enabled'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'private'
      and table_name in ('abuse_rate_limit_buckets', 'abuse_guard_observations')
      and column_name in ('ip', 'ip_address', 'raw_ip', 'fingerprint', 'device_id')
  ),
  0,
  'WU-11 stores neither raw IP addresses nor stable browser fingerprints'
);

update private.abuse_guard_configs
set
  reaction_account_limit = 2,
  reaction_network_limit = 6,
  checkin_account_limit = 2,
  checkin_network_limit = 6;

select results_eq(
  $$
    select is_allowed, risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000101',
      'reaction',
      repeat('a', 64),
      '2026-08-25 10:00:00+00'
    )
    union all
    select is_allowed, risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000101',
      'reaction',
      repeat('a', 64),
      '2026-08-25 10:00:01+00'
    )
    union all
    select is_allowed, risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000101',
      'reaction',
      repeat('a', 64),
      '2026-08-25 10:00:02+00'
    )
  $$,
  $$ values
    (true, '{}'::text[]),
    (true, '{}'::text[]),
    (false, array['RATE_LIMITED']::text[]) $$,
  'the account limit blocks the next mutation before a public reaction exists'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_reactions
    where user_id = '93000000-0000-4000-8000-000000000001'
  ),
  0,
  'a limited guard call never creates a public reaction or summary update'
);

update private.abuse_guard_configs
set
  reaction_account_limit = 6,
  reaction_network_limit = 6;

select results_eq(
  $$
    select risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000002',
      '93000000-0000-4000-8000-000000000102',
      'reaction',
      repeat('b', 64),
      '2026-08-25 10:05:00+00'
    )
    union all
    select risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000003',
      '93000000-0000-4000-8000-000000000102',
      'reaction',
      repeat('b', 64),
      '2026-08-25 10:05:01+00'
    )
    union all
    select risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000004',
      '93000000-0000-4000-8000-000000000102',
      'reaction',
      repeat('b', 64),
      '2026-08-25 10:05:02+00'
    )
  $$,
  $$ values
    ('{}'::text[]),
    ('{}'::text[]),
    (array['ACCOUNT_CLUSTER']::text[]) $$,
  'a short same-network multi-account pattern is held for review rather than declared fraudulent'
);

select results_eq(
  $$
    select risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000005',
      '93000000-0000-4000-8000-000000000101',
      'reaction',
      repeat('c', 64),
      '2026-08-25 10:10:00+00'
    )
    union all
    select risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000005',
      '93000000-0000-4000-8000-000000000102',
      'reaction',
      repeat('c', 64),
      '2026-08-25 10:10:01+00'
    )
    union all
    select risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000005',
      '93000000-0000-4000-8000-000000000103',
      'reaction',
      repeat('c', 64),
      '2026-08-25 10:10:02+00'
    )
    union all
    select risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000005',
      '93000000-0000-4000-8000-000000000104',
      'reaction',
      repeat('c', 64),
      '2026-08-25 10:10:03+00'
    )
  $$,
  $$ values
    ('{}'::text[]),
    ('{}'::text[]),
    ('{}'::text[]),
    (array['REACTION_BURST']::text[]) $$,
  'a rapid multi-restaurant reaction burst becomes a held signal'
);

insert into public.visit_proofs (
  user_id, restaurant_id, method, status, evidence_digest, verified_at, expires_at, created_at
)
values (
  '93000000-0000-4000-8000-000000000006',
  '93000000-0000-4000-8000-000000000105',
  'location_checkin',
  'verified',
  repeat('d', 64),
  '2026-08-25 10:00:00+00',
  '2026-08-26 10:00:00+00',
  '2026-08-25 10:00:00+00'
);

select results_eq(
  $$
    select is_allowed, risk_codes
    from public.enforce_reaction_abuse_guard(
      '93000000-0000-4000-8000-000000000006',
      '93000000-0000-4000-8000-000000000101',
      'reaction',
      repeat('e', 64),
      '2026-08-25 10:15:00+00'
    )
  $$,
  $$ values (true, array['IMPOSSIBLE_TRAVEL']::text[]) $$,
  'impossible travel is an allowed-but-held signal, never an automatic accusation'
);

insert into public.visit_proofs (
  user_id, restaurant_id, method, status, evidence_digest, verified_at, expires_at, created_at
)
values (
  '93000000-0000-4000-8000-000000000006',
  '93000000-0000-4000-8000-000000000101',
  'location_checkin',
  'verified',
  repeat('f', 64),
  '2026-08-25 10:15:00+00',
  '2026-08-26 10:15:00+00',
  '2026-08-25 10:15:00+00'
);

select results_eq(
  $$
    select saved.moderation_status
    from public.save_reaction_with_visit_proof(
      '93000000-0000-4000-8000-000000000006',
      '93000000-0000-4000-8000-000000000101',
      'like',
      repeat('f', 64),
      '2026-08-25 10:15:00+00'
    ) as saved
  $$,
  $$ values ('held'::text) $$,
  'a valid proof with a risk signal becomes held rather than counted'
);

select is(
  (
    select risk_codes
    from public.restaurant_reactions
    where user_id = '93000000-0000-4000-8000-000000000006'
      and restaurant_id = '93000000-0000-4000-8000-000000000101'
  ),
  array['IMPOSSIBLE_TRAVEL']::text[],
  'the held reaction retains the server-calculated risk reason'
);

select is(
  coalesce((
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '93000000-0000-4000-8000-000000000101'
  ), 0),
  0,
  'a held reaction leaves the last normal public summary intact'
);

select is(
  (
    select count(*)::integer
    from public.reaction_events
    where reaction_id = (
      select id
      from public.restaurant_reactions
      where user_id = '93000000-0000-4000-8000-000000000006'
    )
      and event_name = 'held'
      and reason_codes = array['IMPOSSIBLE_TRAVEL']::text[]
  ),
  1,
  'the held moderation result is append-only audited'
);

select * from finish();
