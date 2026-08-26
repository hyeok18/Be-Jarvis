import type { Restaurant } from "@/domain/types";

export function isCanonicalKakaoPlaceId(placeId: string) {
  return /^\d+$/u.test(placeId);
}

export function getKakaoPlaceHref(restaurant: Pick<
  Restaurant,
  "kakaoPlaceId" | "name" | "latitude" | "longitude"
>) {
  if (isCanonicalKakaoPlaceId(restaurant.kakaoPlaceId)) {
    return `https://place.map.kakao.com/${encodeURIComponent(restaurant.kakaoPlaceId)}`;
  }

  return `https://map.kakao.com/link/map/${encodeURIComponent(restaurant.name)},${restaurant.latitude},${restaurant.longitude}`;
}
