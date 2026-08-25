begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select is(
  (select count(*)::integer from public.restaurants where is_active),
  30,
  'WU-15 has exactly 30 active Supabase restaurants'
);

select ok(
  has_column_privilege('anon', 'public.restaurants', 'id', 'select')
    and has_column_privilege('anon', 'public.restaurants', 'name', 'select')
    and has_column_privilege('anon', 'public.restaurants', 'latitude', 'select')
    and not has_column_privilege('anon', 'public.restaurants', 'preference_profile', 'select'),
  'anonymous users can query only the allowlisted restaurant columns'
);

select ok(
  has_table_privilege('anon', 'public.restaurant_reaction_summaries', 'select'),
  'anonymous users can query the public counted projection'
);

select ok(
  not has_table_privilege('anon', 'public.restaurant_reactions', 'select'),
  'anonymous users cannot query held or private reaction rows'
);

select ok(
  not has_table_privilege('anon', 'public.reaction_events', 'select')
    and not has_table_privilege('anon', 'public.visit_proofs', 'select'),
  'anonymous users cannot query audit events or visit proof rows'
);

select ok(
  not has_table_privilege('anon', 'public.creator_channels', 'select')
    and not has_table_privilege('anon', 'public.creator_videos', 'select')
    and not has_table_privilege('anon', 'public.creator_visit_evidence', 'select'),
  'anonymous users cannot bypass the server creator evidence filter'
);

set local role anon;

select is(
  (select count(*)::integer from public.restaurants),
  30,
  'an unauthenticated Data API role sees all 30 active restaurants'
);

select is(
  (select count(*)::integer from public.restaurant_reaction_summaries),
  30,
  'an unauthenticated Data API role sees one public summary per restaurant'
);

reset role;

select results_eq(
  $$
    select
      summary.counted_total,
      count(reaction.id) filter (
        where reaction.moderation_status in ('held', 'private_only')
      )::integer as non_public_raw_count
    from public.restaurant_reaction_summaries as summary
    left join public.restaurant_reactions as reaction
      on reaction.restaurant_id = summary.restaurant_id
      and reaction.is_active
    where summary.restaurant_id = '10000000-0000-4000-8000-000000000001'
    group by summary.counted_total
  $$,
  $$ values (0, 2) $$,
  'held and private_only fixtures do not change the public zero summary'
);

select is(
  (
    select count(*)::integer
    from public.restaurant_reaction_summaries as summary
    join lateral (
      select
        count(*) filter (where reaction.kind = 'like')::integer as like_count,
        count(*) filter (where reaction.kind = 'okay')::integer as okay_count,
        count(*) filter (where reaction.kind = 'dislike')::integer as dislike_count,
        count(*)::integer as counted_total
      from public.restaurant_reactions as reaction
      where reaction.restaurant_id = summary.restaurant_id
        and reaction.is_active
        and reaction.moderation_status = 'counted'
    ) as counted on true
    where summary.like_count <> counted.like_count
      or summary.okay_count <> counted.okay_count
      or summary.dislike_count <> counted.dislike_count
      or summary.counted_total <> counted.counted_total
  ),
  0,
  'every public projection equals active counted reactions only'
);

select cmp_ok(
  (
    select count(*)::integer
    from public.creator_visit_evidence as evidence
    join public.creator_videos as video on video.id = evidence.creator_video_id
    join public.creator_channels as channel on channel.id = video.creator_channel_id
    join public.restaurants as restaurant on restaurant.id = evidence.restaurant_id
    where evidence.status = 'confirmed'
      and evidence.last_verified_at >= now() - interval '30 days'
      and video.privacy_status = 'public'
      and video.is_active
      and video.metadata_fetched_at >= now() - interval '30 days'
      and channel.is_allowlisted
      and channel.is_active
      and channel.metadata_fetched_at >= now() - interval '30 days'
      and restaurant.is_active
  ),
  '>=',
  3,
  'at least three confirmed fresh public videos cross the public server boundary'
);

select cmp_ok(
  (
    select count(*)::integer
    from public.creator_visit_evidence as evidence
    join public.creator_videos as video on video.id = evidence.creator_video_id
    where evidence.id::text like '70000000-0000-4000-8000-%'
      and (
        evidence.status <> 'confirmed'
        or evidence.last_verified_at < now() - interval '30 days'
        or video.privacy_status <> 'public'
        or not video.is_active
        or video.metadata_fetched_at < now() - interval '30 days'
      )
  ),
  '>=',
  2,
  'candidate rejected stale deleted and expired seed evidence remain non-public'
);

select * from finish();

rollback;
