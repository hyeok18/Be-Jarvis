-- Replace the visible grid with deterministic pseudo-random points inside a
-- compact Seongsu-area demo boundary. These are not surveyed coordinates for
-- real businesses and remain consistent with the check-in source of truth.
begin;

with positioned as (
  select
    restaurant.id,
    round((
      37.541700
        + (mod((fixture_no * 73) + (fixture_no * fixture_no * 17) + 11, 997) / 997.0 * 0.005400)
    )::numeric, 6)::double precision as latitude,
    round((
      127.047400
        + (mod((fixture_no * 193) + (fixture_no * fixture_no * 29) + 17, 991) / 991.0 * 0.006700)
    )::numeric, 6)::double precision as longitude
  from public.restaurants as restaurant
  cross join lateral (
    select split_part(restaurant.kakao_place_id, '-', 3)::integer as fixture_no
  ) as fixture
  where restaurant.kakao_place_id like 'synthetic-seongsu-%'
)
update public.restaurants as restaurant
set
  latitude = positioned.latitude,
  longitude = positioned.longitude,
  updated_at = now()
from positioned
where restaurant.id = positioned.id;

commit;
