-- Keep the synthetic demo map readable without presenting fabricated points
-- as exact real-business coordinates. The same values remain in seed.sql so
-- local resets and the shared demo project use the same layout.
begin;

with positioned as (
  select
    restaurant.id,
    round((
      37.541700
        + (((fixture_no - 1) / 5) * 0.001050)
        + (mod(fixture_no * 11, 7) * 0.000035)
    )::numeric, 6)::double precision as latitude,
    round((
      127.047400
        + (mod(fixture_no - 1, 5) * 0.001450)
        + (((fixture_no - 1) / 5) * 0.000180)
        + (mod(fixture_no * 7, 5) * 0.000040)
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
