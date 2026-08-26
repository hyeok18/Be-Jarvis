-- Keep synthetic records clearly labelled while making the map cards easier
-- to scan during the demo. These names are not real business identities.
begin;

with demo_names(fixture_no, demo_name) as (
  values
    (1, '성수 데모 소반'), (2, '성수 데모 면공방'), (3, '성수 데모 오븐골목'),
    (4, '성수 데모 달빛다방'), (5, '성수 데모 향신마당'), (6, '성수 데모 온기밥상'),
    (7, '성수 데모 국수창고'), (8, '성수 데모 작은오븐'), (9, '성수 데모 오후다방'),
    (10, '성수 데모 향신연구소'), (11, '성수 데모 밥상정원'), (12, '성수 데모 면의온도'),
    (13, '성수 데모 골목키친'), (14, '성수 데모 크림라운지'), (15, '성수 데모 아시아식탁'),
    (16, '성수 데모 한끼연구소'), (17, '성수 데모 국물공방'), (18, '성수 데모 파스타정류장'),
    (19, '성수 데모 브루잉룸'), (20, '성수 데모 향신상회'), (21, '성수 데모 밥꽃'),
    (22, '성수 데모 면담'), (23, '성수 데모 오븐산책'), (24, '성수 데모 디저트정류장'),
    (25, '성수 데모 아시아골목'), (26, '성수 데모 정담식당'), (27, '성수 데모 면과국물'),
    (28, '성수 데모 토마토키친'), (29, '성수 데모 낮잠카페'), (30, '성수 데모 향신소반')
)
update public.restaurants as restaurant
set
  name = demo_names.demo_name,
  updated_at = now()
from demo_names
where restaurant.kakao_place_id = 'synthetic-seongsu-' || lpad(demo_names.fixture_no::text, 3, '0');

commit;
