begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(36);

select is(
  (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname = any (array[
        'restaurants',
        'visit_proofs',
        'restaurant_reactions',
        'reaction_events',
        'restaurant_reaction_summaries',
        'creator_channels',
        'creator_videos',
        'creator_visit_evidence',
        'youtube_sync_runs'
      ])
  ),
  9::bigint,
  'all nine WU-03 tables exist'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and c.relname = any (array[
        'restaurants',
        'visit_proofs',
        'restaurant_reactions',
        'reaction_events',
        'restaurant_reaction_summaries',
        'creator_channels',
        'creator_videos',
        'creator_visit_evidence',
        'youtube_sync_runs'
      ])
  ),
  9::bigint,
  'RLS is enabled on every WU-03 table'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'visit_proofs'
      and column_name = any (array[
        'latitude', 'longitude', 'accuracy', 'gps_payload', 'receipt_image', 'raw_payload'
      ])
  ),
  0::bigint,
  'visit proofs contain no raw location or receipt columns'
);

select ok(
  has_column_privilege('anon', 'public.restaurants', 'name', 'select'),
  'anonymous users can read the safe restaurant name column'
);
select ok(
  not has_column_privilege('anon', 'public.restaurants', 'preference_profile', 'select'),
  'anonymous users cannot read the internal preference profile'
);
select ok(
  has_table_privilege('anon', 'public.restaurant_reaction_summaries', 'select'),
  'anonymous users can read public reaction summaries'
);
select ok(
  not has_table_privilege('anon', 'public.visit_proofs', 'select'),
  'anonymous users cannot read visit proofs'
);
select ok(
  has_table_privilege('authenticated', 'public.visit_proofs', 'select'),
  'authenticated users have RLS-gated visit proof reads'
);
select ok(
  has_table_privilege('authenticated', 'public.restaurant_reactions', 'select'),
  'authenticated users have RLS-gated reaction reads'
);
select ok(
  not has_table_privilege('authenticated', 'public.restaurant_reactions', 'insert'),
  'authenticated users cannot bypass the reaction server endpoint'
);
select ok(
  not has_table_privilege('authenticated', 'public.restaurant_reactions', 'update'),
  'authenticated users cannot promote moderation status directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.reaction_events', 'select'),
  'reaction audit events are server-only'
);
select ok(
  not has_table_privilege('anon', 'public.creator_visit_evidence', 'select'),
  'creator candidates are not exposed to anonymous users'
);
select ok(
  has_table_privilege('service_role', 'public.creator_visit_evidence', 'update'),
  'the server role can perform administrator evidence decisions'
);
select ok(
  has_table_privilege('service_role', 'public.reaction_events', 'insert'),
  'the server role can append audit events'
);
select ok(
  not has_table_privilege('service_role', 'public.reaction_events', 'update'),
  'the server role cannot update audit events'
);
select ok(
  not has_table_privilege('service_role', 'public.reaction_events', 'delete'),
  'the server role cannot delete audit events'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname = any (array[
        'restaurants_public_select',
        'visit_proofs_owner_select',
        'restaurant_reactions_owner_select',
        'restaurant_reaction_summaries_public_select',
        'reaction_events_no_client_access',
        'creator_channels_no_client_access',
        'creator_videos_no_client_access',
        'creator_visit_evidence_no_client_access',
        'youtube_sync_runs_no_client_access'
      ])
  ),
  9::bigint,
  'all intended public, owner, and explicit deny policies exist'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname in ('visit_proofs_owner_select', 'restaurant_reactions_owner_select')
      and qual like '%( SELECT auth.uid() AS uid)%'
  ),
  2::bigint,
  'owner policies use the init-plan auth.uid form'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = any (array[
        'restaurants_active_category_name_idx',
        'visit_proofs_user_restaurant_expires_idx',
        'visit_proofs_restaurant_id_idx',
        'restaurant_reactions_restaurant_id_idx',
        'restaurant_reactions_active_moderation_idx',
        'restaurant_reactions_counted_idx',
        'restaurant_reactions_visit_proof_owner_idx',
        'reaction_events_reaction_created_idx',
        'reaction_events_actor_user_id_idx',
        'creator_videos_creator_channel_id_idx',
        'creator_videos_active_channel_published_idx',
        'creator_visit_evidence_restaurant_status_idx',
        'creator_visit_evidence_confirmed_by_idx',
        'youtube_sync_runs_status_started_idx'
      ])
  ),
  14::bigint,
  'all required foreign-key, composite, and partial indexes exist'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'restaurant_reactions_counted_idx'
      and indexdef like '%WHERE (is_active AND (moderation_status = ''counted''::text))%'
  ),
  'the public aggregation index is partial on active counted reactions'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'restaurant_reactions_user_restaurant_unique'
      and contype = 'u'
  ),
  'one current reaction per user and restaurant is enforced'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.restaurant_reactions'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (visit_proof_id)'
  ),
  'a visit proof cannot be reused by another reaction'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'restaurant_reaction_summaries_total_valid'
      and contype = 'c'
  ),
  'summary totals are constrained to the three reaction counts'
);

insert into auth.users (id, aud, role, is_sso_user, is_anonymous, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', false, false, now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', false, false, now(), now());

insert into public.restaurants (
  id, kakao_place_id, name, category_name, address_name, latitude, longitude, is_active
)
values
  ('00000000-0000-0000-0000-000000000201', 'test-active', '합성 활성 식당', '한식', '합성 주소', 37.5, 127.0, true),
  ('00000000-0000-0000-0000-000000000202', 'test-inactive', '합성 비활성 식당', '한식', '합성 주소', 37.5, 127.0, false);

insert into public.visit_proofs (
  id, user_id, restaurant_id, method, status, evidence_digest, verified_at, expires_at
)
values
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000201',
    'location_checkin', 'verified', 'synthetic-digest-1', now(), now() + interval '24 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000201',
    'location_checkin', 'verified', 'synthetic-digest-2', now(), now() + interval '24 hours'
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000201',
    'location_checkin', 'verified', 'synthetic-digest-3', now(), now() + interval '24 hours'
  );

insert into public.restaurant_reactions (
  id, user_id, restaurant_id, visit_proof_id, kind, moderation_status
)
values
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000301',
    'like', 'counted'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000302',
    'okay', 'private_only'
  );

insert into public.restaurant_reaction_summaries (
  restaurant_id, like_count, okay_count, dislike_count, counted_total
)
values
  ('00000000-0000-0000-0000-000000000201', 1, 0, 0, 1),
  ('00000000-0000-0000-0000-000000000202', 0, 0, 0, 0);

insert into public.reaction_events (
  reaction_id, actor_user_id, event_name, after_kind
)
values (
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000101',
  'created',
  'like'
);

select throws_like(
  $$
    insert into public.restaurant_reactions (
      user_id, restaurant_id, kind, moderation_status
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000202',
      'stars',
      'private_only'
    )
  $$,
  '%violates check constraint "restaurant_reactions_kind_valid"%',
  'values outside like, okay, and dislike are rejected'
);

select throws_like(
  $$
    insert into public.restaurant_reactions (
      user_id, restaurant_id, kind, moderation_status
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000201',
      'dislike',
      'private_only'
    )
  $$,
  '%violates unique constraint "restaurant_reactions_user_restaurant_unique"%',
  'duplicate current reactions are rejected'
);

select throws_like(
  $$
    insert into public.restaurant_reactions (
      user_id, restaurant_id, visit_proof_id, kind, moderation_status
    ) values (
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000202',
      '00000000-0000-0000-0000-000000000303',
      'okay',
      'pending'
    )
  $$,
  '%violates foreign key constraint "restaurant_reactions_visit_proof_owner_fk"%',
  'a user cannot attach another user or restaurant visit proof'
);

select throws_ok(
  $$
    update public.reaction_events
    set event_name = 'changed'
    where reaction_id = '00000000-0000-0000-0000-000000000401'
  $$,
  '55000',
  'reaction_events is append-only',
  'audit events cannot be updated'
);

select throws_ok(
  $$
    delete from public.reaction_events
    where reaction_id = '00000000-0000-0000-0000-000000000401'
  $$,
  '55000',
  'reaction_events is append-only',
  'audit events cannot be deleted'
);

set local role anon;
select is(
  (select count(id) from public.restaurants),
  1::bigint,
  'anonymous users only see active restaurants'
);
select is(
  (select count(*) from public.restaurant_reaction_summaries),
  1::bigint,
  'anonymous users only see summaries for active restaurants'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.visit_proofs),
  2::bigint,
  'the first user sees only their own visit proof'
);
select is(
  (select count(*) from public.restaurant_reactions),
  1::bigint,
  'the first user sees only their own reaction'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.visit_proofs),
  1::bigint,
  'the second user cannot see the first users visit proof'
);
select is(
  (select count(*) from public.restaurant_reactions),
  1::bigint,
  'the second user cannot see the first users reaction'
);
reset role;

set local role service_role;
select is(
  (select count(*) from public.creator_visit_evidence),
  0::bigint,
  'the server role can access the administrator evidence table'
);
reset role;

select * from finish();
rollback;
