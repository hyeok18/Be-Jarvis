-- WU-04: deterministic synthetic demo data for local development and testing.
--
-- Safety contract:
-- - Every person, restaurant, address, reaction, and YouTube identifier is fake.
-- - Placeholder Auth users have no email, phone, identity, password, or session.
-- - No raw browser location, receipt, review/comment text, API response, or secret is stored.
-- - Re-running this file updates only the fixed WU-04 UUID namespace and never
--   deletes or overwrites user-created rows.

begin;

-- Thirteen non-login placeholder principals let relational fixtures exercise
-- ownership and unique constraints without borrowing a real Auth account.
insert into auth.users (
  id, aud, role, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous, created_at, updated_at
)
select
  ('20000000-0000-4000-8000-' || lpad(fixture_no::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'fixture', true,
    'fixture_set', 'wu-04-v1',
    'fixture_role', case when fixture_no = 13 then 'creator_evidence_admin' else 'reaction_user' end
  ),
  jsonb_build_object('display_name', '합성 사용자 ' || lpad(fixture_no::text, 2, '0')),
  false,
  false,
  timestamptz '2026-08-25 09:00:00+09',
  timestamptz '2026-08-25 09:00:00+09'
from generate_series(1, 13) as fixture_no
on conflict (id) do update
set
  aud = excluded.aud,
  role = excluded.role,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  is_sso_user = excluded.is_sso_user,
  is_anonymous = excluded.is_anonymous;

-- Thirty clearly labelled, synthetic Seongsu-area restaurant fixtures.
with restaurant_fixture as (
  select
    fixture_no,
    case ((fixture_no - 1) % 5)
      when 0 then '한식'
      when 1 then '일식'
      when 2 then '양식'
      when 3 then '카페·디저트'
      else '아시아음식'
    end as category_name
  from generate_series(1, 30) as fixture_no
)
insert into public.restaurants (
  id, kakao_place_id, name, category_name, address_name, road_address_name,
  latitude, longitude, food_tags, preference_profile, is_active, created_at, updated_at
)
select
  ('10000000-0000-4000-8000-' || lpad(fixture_no::text, 12, '0'))::uuid,
  'synthetic-seongsu-' || lpad(fixture_no::text, 3, '0'),
  '합성 성수 ' || category_name || ' ' || lpad(fixture_no::text, 2, '0'),
  category_name,
  '서울 성동구 성수동 합성길 ' || fixture_no,
  '서울 성동구 합성로 ' || fixture_no || '길 ' || fixture_no,
  -- Deterministic pseudo-random presentation coordinates keep the synthetic
  -- demo map readable without a visible grid. They are not claimed as
  -- surveyed coordinates for real businesses.
  round((
    37.541700
      + (mod((fixture_no * 73) + (fixture_no * fixture_no * 17) + 11, 997) / 997.0 * 0.005400)
  )::numeric, 6)::double precision,
  round((
    127.047400
      + (mod((fixture_no * 193) + (fixture_no * fixture_no * 29) + 17, 991) / 991.0 * 0.006700)
  )::numeric, 6)::double precision,
  case category_name
    when '한식' then array['한식', '밥']::text[]
    when '일식' then array['일식', '면']::text[]
    when '양식' then array['양식', '파스타']::text[]
    when '카페·디저트' then array['카페', '디저트']::text[]
    else array['아시아음식', '향신료']::text[]
  end,
  jsonb_build_object(
    'profileVersion', 'wu-04-v1',
    'axisProfile', jsonb_build_object(
      'spicy', ((fixture_no * 17) % 101),
      'sweet', ((fixture_no * 23) % 101),
      'light', ((fixture_no * 31) % 101),
      'rich', ((fixture_no * 43) % 101),
      'value', ((fixture_no * 47) % 101),
      'cleanliness', 60 + ((fixture_no * 7) % 41),
      'service', 55 + ((fixture_no * 11) % 46)
    )
  ),
  true,
  timestamptz '2026-08-25 09:00:00+09',
  timestamptz '2026-08-25 09:00:00+09'
from restaurant_fixture
on conflict (id) do update
set
  kakao_place_id = excluded.kakao_place_id,
  name = excluded.name,
  category_name = excluded.category_name,
  address_name = excluded.address_name,
  road_address_name = excluded.road_address_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  food_tags = excluded.food_tags,
  preference_profile = excluded.preference_profile,
  is_active = excluded.is_active;

-- Twenty-one proofs back counted reactions; proof 22 is verified but remains
-- pending to exercise the pre-moderation state. Digests are fixture labels,
-- never raw coordinates or provider payloads.
with proof_fixture as (
  select
    proof_no,
    case
      when proof_no <= 9 then proof_no
      when proof_no <= 21 then proof_no - 9
      else 2
    end as user_no,
    case when proof_no <= 9 then 2 when proof_no <= 21 then 3 else 1 end as restaurant_no
  from generate_series(1, 22) as proof_no
)
insert into public.visit_proofs (
  id, user_id, restaurant_id, method, status, evidence_digest,
  verified_at, expires_at, used_at, created_at
)
select
  ('30000000-0000-4000-8000-' || lpad(proof_no::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad(user_no::text, 12, '0'))::uuid,
  ('10000000-0000-4000-8000-' || lpad(restaurant_no::text, 12, '0'))::uuid,
  'location_checkin',
  'verified',
  'synthetic-wu04-proof-digest-' || lpad(proof_no::text, 3, '0'),
  now() - interval '1 hour',
  now() + interval '23 hours',
  case when proof_no <= 21 then now() - interval '30 minutes' else null end,
  now() - interval '2 hours'
from proof_fixture
on conflict (id) do update
set
  user_id = excluded.user_id,
  restaurant_id = excluded.restaurant_id,
  method = excluded.method,
  status = excluded.status,
  evidence_digest = excluded.evidence_digest,
  verified_at = excluded.verified_at,
  expires_at = excluded.expires_at,
  used_at = excluded.used_at,
  created_at = excluded.created_at;

-- Restaurant 02 has nine public reactions (forming distribution).
with reaction_fixture as (
  select
    fixture_no as reaction_no,
    fixture_no as user_no,
    fixture_no as proof_no,
    case when fixture_no <= 5 then 'like' when fixture_no <= 8 then 'okay' else 'dislike' end as kind
  from generate_series(1, 9) as fixture_no
)
insert into public.restaurant_reactions (
  id, user_id, restaurant_id, visit_proof_id, kind, moderation_status,
  risk_codes, is_active, created_at, updated_at
)
select
  ('40000000-0000-4000-8000-' || lpad(reaction_no::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad(user_no::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000002'::uuid,
  ('30000000-0000-4000-8000-' || lpad(proof_no::text, 12, '0'))::uuid,
  kind,
  'counted',
  '{}'::text[],
  true,
  now() - interval '25 hours',
  now() - interval '25 hours'
from reaction_fixture
on conflict (id) do update
set
  user_id = excluded.user_id,
  restaurant_id = excluded.restaurant_id,
  visit_proof_id = excluded.visit_proof_id,
  kind = excluded.kind,
  moderation_status = excluded.moderation_status,
  risk_codes = excluded.risk_codes,
  is_active = excluded.is_active;

-- Restaurant 03 has twelve public reactions (established distribution).
with reaction_fixture as (
  select
    fixture_no + 9 as reaction_no,
    fixture_no as user_no,
    fixture_no + 9 as proof_no,
    case when fixture_no <= 7 then 'like' when fixture_no <= 10 then 'okay' else 'dislike' end as kind
  from generate_series(1, 12) as fixture_no
)
insert into public.restaurant_reactions (
  id, user_id, restaurant_id, visit_proof_id, kind, moderation_status,
  risk_codes, is_active, created_at, updated_at
)
select
  ('40000000-0000-4000-8000-' || lpad(reaction_no::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad(user_no::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000003'::uuid,
  ('30000000-0000-4000-8000-' || lpad(proof_no::text, 12, '0'))::uuid,
  kind,
  'counted',
  '{}'::text[],
  true,
  now() - interval '20 hours',
  now() - interval '20 hours'
from reaction_fixture
on conflict (id) do update
set
  user_id = excluded.user_id,
  restaurant_id = excluded.restaurant_id,
  visit_proof_id = excluded.visit_proof_id,
  kind = excluded.kind,
  moderation_status = excluded.moderation_status,
  risk_codes = excluded.risk_codes,
  is_active = excluded.is_active;

-- Non-public paths cover every moderation state and every P0 risk code. The
-- first restaurant therefore has raw reactions but a zero public summary.
insert into public.restaurant_reactions (
  id, user_id, restaurant_id, visit_proof_id, kind, moderation_status,
  risk_codes, is_active, created_at, updated_at
)
values
  ('40000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', null, 'like', 'private_only', '{}', true, now() - interval '8 hours', now() - interval '8 hours'),
  ('40000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000022', 'okay', 'pending', '{}', true, now() - interval '7 hours', now() - interval '7 hours'),
  ('40000000-0000-4000-8000-000000000024', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', null, 'dislike', 'held', array['REACTION_BURST'], true, now() - interval '6 hours', now() - interval '6 hours'),
  ('40000000-0000-4000-8000-000000000025', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', null, 'like', 'rejected', array['VISIT_PROOF_MISMATCH'], true, now() - interval '5 hours', now() - interval '5 hours'),
  ('40000000-0000-4000-8000-000000000026', '20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', null, 'okay', 'held', array['IMPOSSIBLE_TRAVEL'], true, now() - interval '4 hours', now() - interval '4 hours'),
  ('40000000-0000-4000-8000-000000000027', '20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000005', null, 'like', 'held', array['ACCOUNT_CLUSTER'], true, now() - interval '3 hours', now() - interval '3 hours'),
  ('40000000-0000-4000-8000-000000000028', '20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000006', null, 'dislike', 'held', array['RATE_LIMITED'], true, now() - interval '2 hours', now() - interval '2 hours'),
  ('40000000-0000-4000-8000-000000000029', '20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000007', null, 'okay', 'rejected', array['DUPLICATE_PROOF'], true, now() - interval '1 hour', now() - interval '1 hour')
on conflict (id) do update
set
  user_id = excluded.user_id,
  restaurant_id = excluded.restaurant_id,
  visit_proof_id = excluded.visit_proof_id,
  kind = excluded.kind,
  moderation_status = excluded.moderation_status,
  risk_codes = excluded.risk_codes,
  is_active = excluded.is_active;

-- Append-only audit fixtures use NOT EXISTS instead of update/delete so the
-- seed stays idempotent without weakening the audit trigger.
insert into public.reaction_events (
  reaction_id, actor_user_id, event_name, before_kind, after_kind, reason_codes, created_at
)
select
  reaction.id, reaction.user_id, 'created', null, reaction.kind, '{}', reaction.created_at
from public.restaurant_reactions as reaction
where reaction.id::text like '40000000-0000-4000-8000-%'
  and not exists (
    select 1 from public.reaction_events as event
    where event.reaction_id = reaction.id and event.event_name = 'created'
  );

insert into public.reaction_events (
  reaction_id, actor_user_id, event_name, before_kind, after_kind, reason_codes, created_at
)
select
  reaction.id,
  reaction.user_id,
  case reaction.moderation_status
    when 'counted' then 'counted'
    when 'held' then 'held'
    when 'rejected' then 'rejected'
  end,
  reaction.kind,
  reaction.kind,
  reaction.risk_codes,
  reaction.updated_at
from public.restaurant_reactions as reaction
where reaction.id::text like '40000000-0000-4000-8000-%'
  and reaction.moderation_status in ('counted', 'held', 'rejected')
  and not exists (
    select 1 from public.reaction_events as event
    where event.reaction_id = reaction.id and event.event_name = reaction.moderation_status
  );

-- Materialize the current expected projection. WU-05 will replace this manual
-- projection step with transactional aggregation logic.
insert into public.restaurant_reaction_summaries (
  restaurant_id, like_count, okay_count, dislike_count, counted_total, version, updated_at
)
select
  restaurant.id,
  count(reaction.id) filter (where reaction.kind = 'like')::integer,
  count(reaction.id) filter (where reaction.kind = 'okay')::integer,
  count(reaction.id) filter (where reaction.kind = 'dislike')::integer,
  count(reaction.id)::integer,
  1,
  now()
from public.restaurants as restaurant
left join public.restaurant_reactions as reaction
  on reaction.restaurant_id = restaurant.id
  and reaction.is_active
  and reaction.moderation_status = 'counted'
where restaurant.kakao_place_id like 'synthetic-seongsu-%'
group by restaurant.id
on conflict (restaurant_id) do update
set
  like_count = excluded.like_count,
  okay_count = excluded.okay_count,
  dislike_count = excluded.dislike_count,
  counted_total = excluded.counted_total,
  version = excluded.version,
  updated_at = excluded.updated_at;

-- Four allowlisted synthetic channels cover visible, hidden, and stale
-- subscriber metadata. Values remain raw; no authority score is created.
insert into public.creator_channels (
  id, youtube_channel_id, title, thumbnail_url, subscriber_count,
  subscriber_count_hidden, subscriber_count_fetched_at, uploads_playlist_id,
  is_allowlisted, is_active, metadata_fetched_at, created_at, updated_at
)
values
  ('50000000-0000-4000-8000-000000000001', 'synthetic-channel-01', '합성 맛탐험 채널 A', null, 1250000, false, now() - interval '2 hours', 'synthetic-uploads-01', true, true, now() - interval '2 hours', timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('50000000-0000-4000-8000-000000000002', 'synthetic-channel-02', '합성 한입기록 채널 B', null, 430000, false, now() - interval '3 hours', 'synthetic-uploads-02', true, true, now() - interval '3 hours', timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('50000000-0000-4000-8000-000000000003', 'synthetic-channel-03', '합성 비공개구독 채널 C', null, null, true, now() - interval '1 hour', 'synthetic-uploads-03', true, true, now() - interval '1 hour', timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('50000000-0000-4000-8000-000000000004', 'synthetic-channel-04', '합성 오래된기록 채널 D', null, 85000, false, now() - interval '31 days', 'synthetic-uploads-04', true, true, now() - interval '31 days', timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09')
on conflict (id) do update
set
  youtube_channel_id = excluded.youtube_channel_id,
  title = excluded.title,
  thumbnail_url = excluded.thumbnail_url,
  subscriber_count = excluded.subscriber_count,
  subscriber_count_hidden = excluded.subscriber_count_hidden,
  subscriber_count_fetched_at = excluded.subscriber_count_fetched_at,
  uploads_playlist_id = excluded.uploads_playlist_id,
  is_allowlisted = excluded.is_allowlisted,
  is_active = excluded.is_active,
  metadata_fetched_at = excluded.metadata_fetched_at;

insert into public.creator_videos (
  id, youtube_video_id, creator_channel_id, title, description_excerpt,
  thumbnail_url, published_at, privacy_status, metadata_fetched_at,
  is_active, created_at, updated_at
)
values
  ('60000000-0000-4000-8000-000000000001', 'synthetic-video-01', '50000000-0000-4000-8000-000000000001', '합성 성수 방문 영상 01', 'WU-04 합성 방문 근거 fixture', null, timestamptz '2026-08-10 12:00:00+09', 'public', now() - interval '2 hours', true, timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('60000000-0000-4000-8000-000000000002', 'synthetic-video-02', '50000000-0000-4000-8000-000000000002', '합성 성수 방문 영상 02', 'WU-04 합성 방문 근거 fixture', null, timestamptz '2026-08-11 12:00:00+09', 'public', now() - interval '3 hours', true, timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('60000000-0000-4000-8000-000000000003', 'synthetic-video-03', '50000000-0000-4000-8000-000000000003', '합성 성수 방문 영상 03', '구독자 수 비공개 합성 fixture', null, timestamptz '2026-08-12 12:00:00+09', 'public', now() - interval '1 hour', true, timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('60000000-0000-4000-8000-000000000004', 'synthetic-video-04', '50000000-0000-4000-8000-000000000001', '합성 후보 영상 04', '관리자 확인 전 비공개 후보 fixture', null, timestamptz '2026-08-13 12:00:00+09', 'public', now() - interval '2 hours', true, timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('60000000-0000-4000-8000-000000000005', 'synthetic-video-05', '50000000-0000-4000-8000-000000000002', '합성 거절 영상 05', '장소 불일치로 거절된 합성 fixture', null, timestamptz '2026-08-14 12:00:00+09', 'public', now() - interval '3 hours', true, timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('60000000-0000-4000-8000-000000000006', 'synthetic-video-06', '50000000-0000-4000-8000-000000000004', '합성 만료 영상 06', '삭제·오래된 메타데이터 합성 fixture', null, timestamptz '2026-07-01 12:00:00+09', 'deleted', now() - interval '31 days', false, timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09')
on conflict (id) do update
set
  youtube_video_id = excluded.youtube_video_id,
  creator_channel_id = excluded.creator_channel_id,
  title = excluded.title,
  description_excerpt = excluded.description_excerpt,
  thumbnail_url = excluded.thumbnail_url,
  published_at = excluded.published_at,
  privacy_status = excluded.privacy_status,
  metadata_fetched_at = excluded.metadata_fetched_at,
  is_active = excluded.is_active;

insert into public.creator_visit_evidence (
  id, creator_video_id, restaurant_id, status, video_timestamp_seconds,
  confirmation_note, confirmed_by, confirmed_at, last_verified_at, created_at, updated_at
)
values
  ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'confirmed', 95, '합성 간판과 주소 확인 완료', '20000000-0000-4000-8000-000000000013', now() - interval '1 day', now() - interval '2 hours', timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'confirmed', 140, '합성 메뉴판과 주소 확인 완료', '20000000-0000-4000-8000-000000000013', now() - interval '1 day', now() - interval '3 hours', timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('70000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'confirmed', 210, '합성 장소 외관 확인 완료', '20000000-0000-4000-8000-000000000013', now() - interval '1 day', now() - interval '1 hour', timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('70000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', 'candidate', 65, '관리자 확인 대기 중인 합성 후보', null, null, null, timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('70000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006', 'rejected', 75, '합성 장소 불일치로 거절', null, null, now() - interval '3 hours', timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09'),
  ('70000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000007', 'stale', 180, '삭제·30일 초과로 만료된 합성 근거', null, null, now() - interval '31 days', timestamptz '2026-08-25 09:00:00+09', timestamptz '2026-08-25 09:00:00+09')
on conflict (id) do update
set
  creator_video_id = excluded.creator_video_id,
  restaurant_id = excluded.restaurant_id,
  status = excluded.status,
  video_timestamp_seconds = excluded.video_timestamp_seconds,
  confirmation_note = excluded.confirmation_note,
  confirmed_by = excluded.confirmed_by,
  confirmed_at = excluded.confirmed_at,
  last_verified_at = excluded.last_verified_at;

commit;
