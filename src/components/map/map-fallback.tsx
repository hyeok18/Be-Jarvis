import type { Restaurant } from "@/domain/types";

import type { CreatorVisitSource } from "./map-view-model";

interface MapFallbackProps {
  reason: string;
  restaurants: readonly Restaurant[];
  creatorVisitSources: readonly CreatorVisitSource[];
  selectedRestaurantId: string | null;
  onSelectRestaurant: (restaurantId: string) => void;
}

export function MapFallback({
  reason,
  restaurants,
  creatorVisitSources,
  selectedRestaurantId,
  onSelectRestaurant,
}: MapFallbackProps) {
  const creatorSourcesByRestaurantId = new Map<string, CreatorVisitSource[]>();

  for (const source of creatorVisitSources) {
    const sources = creatorSourcesByRestaurantId.get(source.restaurantId) ?? [];
    sources.push(source);
    creatorSourcesByRestaurantId.set(source.restaurantId, sources);
  }

  return (
    <div className="map-fallback">
      <div role="status">
        <p className="map-fallback-title">지도를 불러오지 못했어요</p>
        <p>{reason} 아래 주소 목록으로 계속 탐색할 수 있습니다.</p>
      </div>

      <ul>
        {restaurants.map((restaurant) => (
          <li key={restaurant.id}>
            <button
              type="button"
              aria-pressed={restaurant.id === selectedRestaurantId}
              onClick={() => onSelectRestaurant(restaurant.id)}
            >
              <strong>{restaurant.name}</strong>
              <span>{restaurant.roadAddress ?? restaurant.address ?? "주소 확인 중"}</span>
            </button>
            <div className="map-fallback-links">
              <a
                href={`https://map.kakao.com/link/map/${encodeURIComponent(restaurant.name)},${restaurant.latitude},${restaurant.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                카카오맵에서 보기
              </a>
              {(creatorSourcesByRestaurantId.get(restaurant.id) ?? []).map(
                (source) => (
                  <a
                    key={source.videoId}
                    href={source.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    YouTube 원본 보기
                  </a>
                ),
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
