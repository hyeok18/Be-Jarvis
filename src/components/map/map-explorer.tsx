"use client";

import { useCallback, useMemo, useState } from "react";

import type { Restaurant, RestaurantReactionSummary } from "@/domain/types";

import { CategoryFilter } from "./category-filter";
import { CreatorLayerToggle } from "./creator-layer-toggle";
import type { CreatorVisitSource } from "./map-view-model";
import { RestaurantMap } from "./restaurant-map";

interface MapExplorerProps {
  restaurants: readonly Restaurant[];
  reactionSummaries: readonly RestaurantReactionSummary[];
  creatorVisitSources: readonly CreatorVisitSource[];
}

const ALL_CATEGORIES = "전체";

export function MapExplorer({
  restaurants,
  reactionSummaries,
  creatorVisitSources,
}: MapExplorerProps) {
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [creatorLayerActive, setCreatorLayerActive] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    restaurants[0]?.id ?? null,
  );
  const [mapOpen, setMapOpen] = useState(true);

  const categories = useMemo(
    () => [
      ALL_CATEGORIES,
      ...Array.from(new Set(restaurants.map((restaurant) => restaurant.categoryName))),
    ],
    [restaurants],
  );
  const creatorSourcesByRestaurantId = useMemo(() => {
    const sourcesByRestaurantId = new Map<string, CreatorVisitSource[]>();

    for (const source of creatorVisitSources) {
      const sources = sourcesByRestaurantId.get(source.restaurantId) ?? [];
      sources.push(source);
      sourcesByRestaurantId.set(source.restaurantId, sources);
    }

    return sourcesByRestaurantId;
  }, [creatorVisitSources]);
  const creatorIdSet = useMemo(
    () => new Set(creatorSourcesByRestaurantId.keys()),
    [creatorSourcesByRestaurantId],
  );
  const summaryByRestaurantId = useMemo(
    () =>
      new Map(
        reactionSummaries.map((summary) => [summary.restaurantId, summary]),
      ),
    [reactionSummaries],
  );
  const visibleRestaurants = useMemo(
    () =>
      restaurants.filter((restaurant) => {
        const categoryMatches =
          selectedCategory === ALL_CATEGORIES ||
          restaurant.categoryName === selectedCategory;
        const layerMatches =
          !creatorLayerActive || creatorIdSet.has(restaurant.id);
        return categoryMatches && layerMatches;
      }),
    [creatorIdSet, creatorLayerActive, restaurants, selectedCategory],
  );
  const activeSelectedRestaurantId = visibleRestaurants.some(
    (restaurant) => restaurant.id === selectedRestaurantId,
  )
    ? selectedRestaurantId
    : (visibleRestaurants[0]?.id ?? null);

  const handleSelectRestaurant = useCallback((restaurantId: string) => {
    setSelectedRestaurantId(restaurantId);
  }, []);

  return (
    <section className="map-section" aria-labelledby="map-section-title">
      <div className="map-section-heading">
        <div>
          <p className="eyebrow">지도 탐색</p>
          <h2 id="map-section-title">성수동에서 골라보세요</h2>
          <p>
            별점 대신 방문 확인을 거친 세 반응과 확인된 영상 방문 근거를
            비교합니다.
          </p>
        </div>
        <CreatorLayerToggle
          active={creatorLayerActive}
          count={creatorIdSet.size}
          onToggle={() => setCreatorLayerActive((active) => !active)}
        />
      </div>

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <button
        type="button"
        className="map-visibility-toggle"
        aria-expanded={mapOpen}
        aria-controls="restaurant-map-panel"
        onClick={() => setMapOpen((open) => !open)}
      >
        {mapOpen ? "지도 접기" : "지도 펼치기"}
      </button>

      {visibleRestaurants.length === 0 ? (
        <div className="empty-map-result" role="status">
          현재 조건에 맞는 식당이 없습니다. 필터를 변경해 주세요.
        </div>
      ) : (
        <div className="map-explorer-layout">
          <ul className="restaurant-list" aria-label="현재 조건의 식당 목록">
            {visibleRestaurants.map((restaurant) => {
              const summary = summaryByRestaurantId.get(restaurant.id);
              const selected = restaurant.id === activeSelectedRestaurantId;
              const creatorSources =
                creatorSourcesByRestaurantId.get(restaurant.id) ?? [];
              const hasCreatorVisit = creatorSources.length > 0;

              return (
                <li key={restaurant.id} className="restaurant-list-item">
                  <button
                    type="button"
                    className="restaurant-card"
                    aria-pressed={selected}
                    onClick={() => handleSelectRestaurant(restaurant.id)}
                  >
                    <span className="restaurant-card-topline">
                      <span className="category-badge">{restaurant.categoryName}</span>
                      {hasCreatorVisit && (
                        <span className="creator-badge">영상 방문 확인</span>
                      )}
                    </span>
                    <strong>{restaurant.name}</strong>
                    <span className="restaurant-address">
                      {restaurant.roadAddress ?? restaurant.address ?? "주소 확인 중"}
                    </span>

                    {summary && summary.countedTotal > 0 ? (
                      <span className="reaction-summary">
                        <span>좋아요 {summary.counts.like}</span>
                        <span>그냥 그래요 {summary.counts.okay}</span>
                        <span>싫어요 {summary.counts.dislike}</span>
                      </span>
                    ) : (
                      <span className="forming-state">
                        아직 방문 인증 반응이 없어요
                      </span>
                    )}
                    {summary?.isForming && summary.countedTotal > 0 && (
                      <span className="forming-state">반응 모으는 중</span>
                    )}
                  </button>
                  {hasCreatorVisit && (
                    <ul
                      className="creator-source-list"
                      aria-label={`${restaurant.name} YouTube 방문 근거`}
                    >
                      {creatorSources.map((source) => (
                        <li key={source.videoId}>
                          <a
                            href={source.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span>{source.channelTitle}</span>
                            <strong>{source.videoTitle}</strong>
                            <small>
                              {source.hiddenSubscriberCount
                                ? "구독자 수 비공개"
                                : source.subscriberCount === null
                                  ? "구독자 수 확인 중"
                                  : `구독자 ${source.subscriberCount.toLocaleString("ko-KR")}명`}
                              {` · 영상 ${source.publishedAt.slice(0, 10)}`}
                              {` · API 기준 ${source.metadataFetchedAt.slice(0, 10)}`}
                            </small>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {mapOpen && (
            <div id="restaurant-map-panel" className="map-panel">
              <RestaurantMap
                restaurants={visibleRestaurants}
                selectedRestaurantId={activeSelectedRestaurantId}
                creatorVisitSources={creatorVisitSources}
                onSelectRestaurant={handleSelectRestaurant}
              />
              <p className="map-legend">
                <span><i className="legend-dot standard" /> 일반 식당</span>
                <span><i className="legend-dot creator" /> 확인된 영상 방문</span>
                <span><i className="legend-dot selected" /> 선택한 식당</span>
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
