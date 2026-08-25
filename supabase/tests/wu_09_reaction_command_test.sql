begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(34);

insert into auth.users (id, aud, role, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', false, false, now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', false, false, now(), now());

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
    '91000000-0000-4000-8000-000000000101',
    'synthetic-wu09-active',
    '합성 WU-09 활성 식당',
    '한식',
    '합성 주소',
    37.543,
    127.05,
    true
  ),
  (
    '91000000-0000-4000-8000-000000000102',
    'synthetic-wu09-inactive',
    '합성 WU-09 비활성 식당',
    '한식',
    '합성 주소',
    37.544,
    127.051,
    false
  );

select has_function(
  'public',
  'save_reaction_selection',
  array['uuid', 'uuid', 'text'],
  'the server reaction selection command exists'
);

select ok(
  (
    select not p.prosecdef
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_reaction_selection'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_restaurant_id uuid, p_kind text'
  ),
  'the command uses caller privileges instead of bypassing RLS with a definer'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_reaction_selection(uuid,uuid,text)',
    'execute'
  ),
  'anonymous users cannot execute the server command'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_reaction_selection(uuid,uuid,text)',
    'execute'
  ),
  'authenticated clients cannot bypass the server route'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.save_reaction_selection(uuid,uuid,text)',
    'execute'
  ),
  'the service role can execute the command'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_trigger
    where tgrelid = 'public.restaurant_reactions'::regclass
      and tgname = 'restaurant_reactions_append_selection_event'
      and not tgisinternal
  ),
  1,
  'one automatic selection audit trigger is installed'
);

select results_eq(
  $$
    select reaction_kind, moderation_status, was_created, was_changed
    from public.save_reaction_selection(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000101',
      'like'
    )
  $$,
  $$ values ('like'::text, 'private_only'::text, true, true) $$,
  'a first selection creates a private-only reaction'
);

select results_eq(
  $$
    select kind, moderation_status, visit_proof_id, is_active
    from public.restaurant_reactions
    where user_id = '91000000-0000-4000-8000-000000000001'
      and restaurant_id = '91000000-0000-4000-8000-000000000101'
  $$,
  $$ values ('like'::text, 'private_only'::text, null::uuid, true) $$,
  'the stored row has no proof and cannot enter the public count'
);

select results_eq(
  $$
    select event_name, before_kind, after_kind
    from public.reaction_events
    where reaction_id = (
      select id
      from public.restaurant_reactions
      where user_id = '91000000-0000-4000-8000-000000000001'
        and restaurant_id = '91000000-0000-4000-8000-000000000101'
    )
    order by id
  $$,
  $$ values ('created'::text, null::text, 'like'::text) $$,
  'creation appends one audit event'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '91000000-0000-4000-8000-000000000101'
  ),
  0,
  'a private-only selection leaves the public summary at zero'
);

select results_eq(
  $$
    select was_created, was_changed
    from public.save_reaction_selection(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000101',
      'like'
    )
  $$,
  $$ values (false, false) $$,
  'repeating the same selection is idempotent'
);

select is(
  (
    select count(*)::integer
    from public.reaction_events
    where reaction_id = (
      select id
      from public.restaurant_reactions
      where user_id = '91000000-0000-4000-8000-000000000001'
        and restaurant_id = '91000000-0000-4000-8000-000000000101'
    )
  ),
  1,
  'an idempotent retry does not add an audit event'
);

select results_eq(
  $$
    select reaction_kind, was_created, was_changed
    from public.save_reaction_selection(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000101',
      'dislike'
    )
  $$,
  $$ values ('dislike'::text, false, true) $$,
  'a new selection updates the existing reaction'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_reactions
    where user_id = '91000000-0000-4000-8000-000000000001'
      and restaurant_id = '91000000-0000-4000-8000-000000000101'
  ),
  1,
  'one current row remains for the user and restaurant'
);

select is(
  (
    select kind
    from public.restaurant_reactions
    where user_id = '91000000-0000-4000-8000-000000000001'
      and restaurant_id = '91000000-0000-4000-8000-000000000101'
  ),
  'dislike',
  'the current row stores the new selection'
);

select results_eq(
  $$
    select event_name, before_kind, after_kind
    from public.reaction_events
    where reaction_id = (
      select id
      from public.restaurant_reactions
      where user_id = '91000000-0000-4000-8000-000000000001'
        and restaurant_id = '91000000-0000-4000-8000-000000000101'
    )
    order by id
  $$,
  $$ values
    ('created'::text, null::text, 'like'::text),
    ('changed'::text, 'like'::text, 'dislike'::text)
  $$,
  'a changed selection preserves its before and after values'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '91000000-0000-4000-8000-000000000101'
  ),
  0,
  'changing a private reaction does not affect the public summary'
);

select is(
  (
    select was_created
    from public.save_reaction_selection(
      '91000000-0000-4000-8000-000000000002',
      '91000000-0000-4000-8000-000000000101',
      'okay'
    )
  ),
  true,
  'another user receives a separate current reaction'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_reactions
    where restaurant_id = '91000000-0000-4000-8000-000000000101'
  ),
  2,
  'the restaurant now has one current row per user'
);

select throws_ok(
  $$
    select *
    from public.save_reaction_selection(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000101',
      'stars'
    )
  $$,
  '22023',
  'reaction kind must be like, okay, or dislike',
  'unknown reaction values fail closed'
);

select is(
  (
    select count(*)::integer
    from public.reaction_events
    where reaction_id = (
      select id
      from public.restaurant_reactions
      where user_id = '91000000-0000-4000-8000-000000000001'
        and restaurant_id = '91000000-0000-4000-8000-000000000101'
    )
  ),
  2,
  'a rejected value leaves the audit history unchanged'
);

select throws_ok(
  $$
    select *
    from public.save_reaction_selection(
      '91000000-0000-4000-8000-000000000999',
      '91000000-0000-4000-8000-000000000101',
      'like'
    )
  $$,
  '23503',
  'authenticated user does not exist',
  'an unknown user cannot create a reaction'
);

select throws_ok(
  $$
    select *
    from public.save_reaction_selection(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000102',
      'like'
    )
  $$,
  '23503',
  'active restaurant does not exist',
  'an inactive restaurant cannot receive a reaction'
);

select throws_ok(
  $$
    select *
    from public.save_reaction_selection(
      null,
      '91000000-0000-4000-8000-000000000101',
      'like'
    )
  $$,
  '22004',
  'user_id and restaurant_id are required',
  'a missing authenticated user id fails closed'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.restaurant_reactions),
  1,
  'RLS exposes only the current users reaction'
);
reset role;

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
  '91000000-0000-4000-8000-000000000201',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000101',
  'location_checkin',
  'verified',
  'synthetic-wu09-counted-proof',
  now() - interval '1 hour',
  now() + interval '23 hours',
  now() - interval '1 hour'
);

update public.restaurant_reactions
set
  visit_proof_id = '91000000-0000-4000-8000-000000000201',
  moderation_status = 'pending'
where user_id = '91000000-0000-4000-8000-000000000001'
  and restaurant_id = '91000000-0000-4000-8000-000000000101';

select is(
  (
    select moderation_status
    from private.apply_reaction_moderation(
      (
        select id
        from public.restaurant_reactions
        where user_id = '91000000-0000-4000-8000-000000000001'
          and restaurant_id = '91000000-0000-4000-8000-000000000101'
      ),
      'counted',
      '{}',
      '91000000-0000-4000-8000-000000000001',
      now()
    )
  ),
  'counted',
  'the existing moderation engine can count the selected reaction'
);

select results_eq(
  $$
    select like_count, okay_count, dislike_count, counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '91000000-0000-4000-8000-000000000101'
  $$,
  $$ values (0, 0, 1, 1) $$,
  'the counted reaction enters the public distribution'
);

select results_eq(
  $$
    select reaction_kind, moderation_status, was_changed
    from public.save_reaction_selection(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000101',
      'okay'
    )
  $$,
  $$ values ('okay'::text, 'counted'::text, true) $$,
  'changing a counted reaction preserves its valid moderation state'
);

select results_eq(
  $$
    select like_count, okay_count, dislike_count, counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '91000000-0000-4000-8000-000000000101'
  $$,
  $$ values (0, 1, 0, 1) $$,
  'a counted kind change moves the public distribution atomically'
);

select results_eq(
  $$
    select event_name, before_kind, after_kind
    from public.reaction_events
    where reaction_id = (
      select id
      from public.restaurant_reactions
      where user_id = '91000000-0000-4000-8000-000000000001'
        and restaurant_id = '91000000-0000-4000-8000-000000000101'
    )
    order by id desc
    limit 2
  $$,
  $$ values
    ('changed'::text, 'dislike'::text, 'okay'::text),
    ('counted'::text, 'dislike'::text, 'dislike'::text)
  $$,
  'counted moderation and later selection changes are both auditable'
);

update public.restaurant_reactions
set
  moderation_status = 'held',
  risk_codes = array['REACTION_BURST'],
  is_active = false
where user_id = '91000000-0000-4000-8000-000000000001'
  and restaurant_id = '91000000-0000-4000-8000-000000000101';

select results_eq(
  $$
    select reaction_kind, moderation_status, was_created, was_changed
    from public.save_reaction_selection(
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000101',
      'like'
    )
  $$,
  $$ values ('like'::text, 'private_only'::text, false, true) $$,
  'reactivating an old row resets it to private only'
);

select results_eq(
  $$
    select visit_proof_id, risk_codes, is_active
    from public.restaurant_reactions
    where user_id = '91000000-0000-4000-8000-000000000001'
      and restaurant_id = '91000000-0000-4000-8000-000000000101'
  $$,
  $$ values (null::uuid, '{}'::text[], true) $$,
  'reactivation cannot reuse an old proof or risk state'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '91000000-0000-4000-8000-000000000101'
  ),
  0,
  'reactivation keeps the public projection at its last valid zero state'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema in ('public', 'private')
      and table_name in ('restaurant_reactions', 'reaction_events')
      and column_name in ('review', 'comment', 'rating', 'score', 'raw_location')
  ),
  0,
  'the command adds no public text, rating, score, or raw location field'
);

select * from finish();

rollback;
