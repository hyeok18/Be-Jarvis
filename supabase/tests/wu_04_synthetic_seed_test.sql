begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select is(
  (select count(*)::integer from public.restaurants where kakao_place_id like 'synthetic-seongsu-%'),
  30,
  'seed contains exactly 30 synthetic restaurants'
);

select is(
  (
    select count(*)::integer
    from public.restaurants
    where kakao_place_id like 'synthetic-seongsu-%'
      and name like '합성 %'
      and address_name like '%합성%'
  ),
  30,
  'every restaurant is visibly marked as synthetic'
);

select is(
  (
    select count(*)::integer
    from auth.users
    where raw_app_meta_data ->> 'fixture_set' = 'wu-04-v1'
  ),
  13,
  'seed contains 13 synthetic non-login principals'
);

select is(
  (
    select count(*)::integer
    from auth.users
    where raw_app_meta_data ->> 'fixture_set' = 'wu-04-v1'
      and (email is not null or phone is not null or encrypted_password is not null)
  ),
  0,
  'synthetic principals contain no email phone or password'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '10000000-0000-4000-8000-000000000001'
  ),
  0,
  'restaurant 01 has a zero public reaction state'
);

select is(
  (
    select counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '10000000-0000-4000-8000-000000000002'
  ),
  9,
  'restaurant 02 has a forming distribution under ten reactions'
);

select results_eq(
  $$
    select like_count, okay_count, dislike_count, counted_total
    from public.restaurant_reaction_summaries
    where restaurant_id = '10000000-0000-4000-8000-000000000003'
  $$,
  $$ values (7, 3, 2, 12) $$,
  'restaurant 03 has the established 7 3 2 distribution'
);

select is(
  (
    select count(distinct moderation_status)::integer
    from public.restaurant_reactions
    where id::text like '40000000-0000-4000-8000-%'
  ),
  5,
  'all five moderation states are represented'
);

select is(
  (
    select count(distinct risk_code)::integer
    from public.restaurant_reactions,
      unnest(risk_codes) as risk_code
    where id::text like '40000000-0000-4000-8000-%'
  ),
  6,
  'all six P0 risk codes are represented'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_reaction_summaries as summary
    join public.restaurants as restaurant on restaurant.id = summary.restaurant_id
    left join lateral (
      select
        count(*) filter (where reaction.kind = 'like')::integer as like_count,
        count(*) filter (where reaction.kind = 'okay')::integer as okay_count,
        count(*) filter (where reaction.kind = 'dislike')::integer as dislike_count,
        count(*)::integer as counted_total
      from public.restaurant_reactions as reaction
      where reaction.restaurant_id = restaurant.id
        and reaction.is_active
        and reaction.moderation_status = 'counted'
    ) as expected on true
    where restaurant.kakao_place_id like 'synthetic-seongsu-%'
      and (
        summary.like_count <> expected.like_count
        or summary.okay_count <> expected.okay_count
        or summary.dislike_count <> expected.dislike_count
        or summary.counted_total <> expected.counted_total
      )
  ),
  0,
  'every summary equals active counted reactions only'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_reactions as reaction
    left join public.visit_proofs as proof on proof.id = reaction.visit_proof_id
    where reaction.id::text like '40000000-0000-4000-8000-%'
      and reaction.moderation_status = 'counted'
      and (
        proof.id is null
        or proof.status <> 'verified'
        or proof.user_id <> reaction.user_id
        or proof.restaurant_id <> reaction.restaurant_id
        or proof.expires_at <= now()
      )
  ),
  0,
  'every counted reaction owns a currently valid verified proof'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_reactions
    where id::text like '40000000-0000-4000-8000-%'
  ),
  29,
  'reaction fixture row count is stable'
);

select is(
  (
    select count(*)::integer
    from public.reaction_events
    where reaction_id::text like '40000000-0000-4000-8000-%'
  ),
  56,
  'append-only event fixture count is stable after repeated seeding'
);

select is(
  (
    select count(*)::integer
    from public.creator_channels
    where youtube_channel_id like 'synthetic-channel-%'
  ),
  4,
  'seed contains four synthetic creator channels'
);

select is(
  (
    select count(*)::integer
    from public.creator_videos
    where youtube_video_id like 'synthetic-video-%'
  ),
  6,
  'seed contains six synthetic creator videos'
);

select is(
  (
    select count(distinct status)::integer
    from public.creator_visit_evidence
    where id::text like '70000000-0000-4000-8000-%'
  ),
  4,
  'candidate confirmed rejected and stale evidence states are represented'
);

select is(
  (
    select count(*)::integer
    from public.creator_channels
    where youtube_channel_id like 'synthetic-channel-%'
      and subscriber_count_hidden
      and subscriber_count is null
  ),
  1,
  'hidden subscriber metadata stores no subscriber number'
);

select is(
  (
    select count(*)::integer
    from public.creator_channels
    where youtube_channel_id = 'synthetic-channel-04'
      and metadata_fetched_at < now() - interval '30 days'
      and subscriber_count_fetched_at < now() - interval '30 days'
  ),
  1,
  'stale creator metadata is older than the 30 day freshness boundary'
);

select is(
  (
    select count(*)::integer
    from public.creator_visit_evidence as evidence
    join public.creator_videos as video on video.id = evidence.creator_video_id
    join public.creator_channels as channel on channel.id = video.creator_channel_id
    where evidence.id::text like '70000000-0000-4000-8000-%'
      and evidence.status = 'confirmed'
      and evidence.last_verified_at >= now() - interval '30 days'
      and video.is_active
      and video.privacy_status = 'public'
      and video.metadata_fetched_at >= now() - interval '30 days'
      and channel.is_active
      and channel.is_allowlisted
      and channel.metadata_fetched_at >= now() - interval '30 days'
  ),
  3,
  'only three confirmed fresh evidence rows are eligible for a public DTO'
);

select is(
  (
    select count(*)::integer
    from public.creator_visit_evidence as evidence
    join public.creator_videos as video on video.id = evidence.creator_video_id
    join public.creator_channels as channel on channel.id = video.creator_channel_id
    where evidence.status = 'confirmed'
      and channel.subscriber_count_hidden
      and channel.subscriber_count is null
  ),
  1,
  'confirmed evidence supports a hidden subscriber count without inventing a value'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'restaurant_reactions',
        'restaurant_reaction_summaries',
        'creator_channels',
        'creator_videos',
        'creator_visit_evidence'
      )
      and column_name ~ '(rating|score|trust|credibility)'
  ),
  0,
  'fixtures rely on raw reactions and subscriber counts without rating or trust scores'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('restaurant_reactions', 'reaction_events')
      and column_name in ('review', 'review_text', 'comment', 'comment_text')
  ),
  0,
  'reaction fixtures have no public review or comment text field'
);

select * from finish();

rollback;
