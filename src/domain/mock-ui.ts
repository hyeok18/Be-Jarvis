import { DOMAIN_FIXTURE } from "./fixtures";
import { calculateRestaurantMatch, summarizeRestaurantReactions } from "./signals";
import type { Restaurant, RestaurantPreferenceProfile } from "./types";

export const MOCK_RESTAURANTS: readonly Restaurant[] = [
  ...DOMAIN_FIXTURE.restaurants,
  {
    id: "restaurant-new-noodle",
    kakaoPlaceId: "synthetic-place-003",
    name: "새참 국수 성수",
    categoryGroupCode: "FD6",
    categoryName: "국수",
    roadAddress: "서울 성동구 합성로 3",
    address: "서울 성동구 성수동 합성 3",
    latitude: 37.5438,
    longitude: 127.0549,
    region: "성수동",
    createdAt: DOMAIN_FIXTURE.now,
  },
];

const MOCK_PROFILES: readonly RestaurantPreferenceProfile[] = [
  ...DOMAIN_FIXTURE.restaurantProfiles,
  {
    restaurantId: "restaurant-new-noodle",
    axisProfile: { spicy: 55, sweet: 20, light: 75, rich: 35, value: 80, cleanliness: 85, service: 75 },
    foodTags: ["noodle", "wheat"],
  },
];

export function getMockRestaurantCards() {
  return MOCK_RESTAURANTS.map((restaurant) => {
    const profile = MOCK_PROFILES.find((item) => item.restaurantId === restaurant.id);
    if (!profile) throw new Error(`Missing preference profile for ${restaurant.id}`);
    return {
      restaurant,
      reaction: summarizeRestaurantReactions(restaurant.id, DOMAIN_FIXTURE.reactions),
      match: calculateRestaurantMatch({ profile: DOMAIN_FIXTURE.userProfile, restaurant: profile }),
    };
  });
}

export function getMockRestaurant(id: string) {
  return getMockRestaurantCards().find((card) => card.restaurant.id === id) ?? null;
}

export function getMockCreatorEvidence(restaurantId: string) {
  if (restaurantId !== "restaurant-balanced-bowl") return [];
  return [
    {
      channelName: "합성 대형 맛집 채널",
      title: "성수동 맛집 3곳 비교 · 먹방로그",
      publishedLabel: "2주 전",
      subscriberLabel: "구독자 230만",
      url: "https://www.youtube.com/",
    },
  ];
}
