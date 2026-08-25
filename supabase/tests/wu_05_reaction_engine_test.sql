begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

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

select * from finish();

rollback;
