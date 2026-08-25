"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import type { RestaurantMatchResult } from "@/domain/types";

import { CategoryFilter } from "./category-filter";
import { CreatorLayerToggle } from "./creator-layer-toggle";
import {
  formatFoodTag,
  sortRestaurantsForMode,
  type CreatorVisitSource,
  type ExplorerMode,
} from "./map-view-model";
import type { MapExplorerData } from "./map-explorer-data";
import { PersonalMatchSummary } from "./personal-match-summary";
import { ReactionDistribution } from "./reaction-distribution";
import { RestaurantMap } from "./restaurant-map";

const ALL_CATEGORIES = "전체";
const MODES: readonly { id: ExplorerMode; label: string }[] = [
  { id: "public", label: "공개 반응" },
  { id: "personal", label: "나와의 매칭" },
];

export function MapExplorer({
  restaurants,
  reactionSummaries,
  personalMatches,
  creatorVisitSources,
}: MapExplorerData) {
  const [mode, setMode] = useState<ExplorerMode>("public");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [creatorLayerActive, setCreatorLayerActive] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    restaurants[0]?.id ?? null,
  );
  const [mapOpen, setMapOpen] = useState(true);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
  const matchByRestaurantId = useMemo(
    () =>
      new Map(personalMatches.map((match) => [match.restaurantId, match])),
    [personalMatches],
  );
  const filteredRestaurants = useMemo(
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
  const excludedMatches = useMemo(
    () =>
      filteredRestaurants
        .map((restaurant) => matchByRestaurantId.get(restaurant.id))
        .filter(
          (match): match is RestaurantMatchResult => match?.status === "excluded",
        ),
    [filteredRestaurants, matchByRestaurantId],
  );
  const visibleRestaurants = useMemo(
    () => sortRestaurantsForMode(filteredRestaurants, mode, personalMatches),
    [filteredRestaurants, mode, personalMatches],
  );
  const activeSelectedRestaurantId = visibleRestaurants.some(
    (restaurant) => restaurant.id === selectedRestaurantId,
  )
    ? selectedRestaurantId
    : (visibleRestaurants[0]?.id ?? null);

  const handleSelectRestaurant = useCallback((restaurantId: string) => {
    setSelectedRestaurantId(restaurantId);
  }, []);

  const handleTabKeyDown = (index: number, key: string) => {
    let nextIndex: number | null = null;
    if (key === "ArrowRight") nextIndex = (index + 1) % MODES.length;
    if (key === "ArrowLeft") nextIndex = (index - 1 + MODES.length) % MODES.length;
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = MODES.length - 1;
    if (nextIndex === null) return;

    const nextMode = MODES[nextIndex];
    setMode(nextMode.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section className="map-section" aria-labelledby="map-section-title">
      <div className="explorer-tabs" role="tablist" aria-label="식당 탐색 기준">
        {MODES.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`explorer-${item.id}-tab`}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            aria-controls="restaurant-explorer-panel"
            tabIndex={mode === item.id ? 0 : -1}
            onClick={() => setMode(item.id)}
            onKeyDown={(event) => {
              if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
                event.preventDefault();
              }
              handleTabKeyDown(index, event.key);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id="restaurant-explorer-panel"
        role="tabpanel"
        aria-labelledby={`explorer-${mode}-tab`}
      >
        <div className="map-section-heading">
          <div>
            <p className="eyebrow">
              {mode === "public" ? "방문 확인 반응" : "개인 취향 탐색"}
            </p>
            <h2 id="map-section-title">
              {mode === "public"
                ? "성수동의 세 반응을 비교해 보세요"
                : "내 취향에 가까운 순서로 살펴보세요"}
            </h2>
            <p>
              {mode === "public"
                ? "방문 확인을 거쳐 공개 집계된 좋아요, 그냥 그래요, 싫어요만 보여 줍니다."
                : "내가 입력한 취향, 비슷한 사용자, 이전 방문 기록을 공개 반응과 분리해 계산합니다."}
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

        {mode === "personal" && excludedMatches.length > 0 && (
          <aside className="excluded-food-notice" aria-label="개인 매칭 제외 안내">
            <strong>먹지 않는 음식은 매칭 결과에서 제외했어요.</strong>
            <span>
              {Array.from(
                new Set(
                  excludedMatches.flatMap((match) =>
                    match.excludedFoodTags.map(formatFoodTag),
                  ),
                ),
              ).join(", ")}
              {` 포함 식당 ${excludedMatches.length}곳`}
            </span>
          </aside>
        )}

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
            {mode === "personal" && excludedMatches.length > 0
              ? "현재 조건의 식당은 먹지 않는 음식 설정으로 모두 제외됐어요. 필터를 변경해 주세요."
              : "현재 조건에 맞는 식당이 없습니다. 필터를 변경해 주세요."}
          </div>
        ) : (
          <div className="map-explorer-layout">
            <ul className="restaurant-list" aria-label="현재 조건의 식당 목록">
              {visibleRestaurants.map((restaurant, index) => {
                const summary = summaryByRestaurantId.get(restaurant.id);
                const match = matchByRestaurantId.get(restaurant.id);
                const selected = restaurant.id === activeSelectedRestaurantId;
                const creatorSources =
                  creatorSourcesByRestaurantId.get(restaurant.id) ?? [];
                const hasCreatorVisit = creatorSources.length > 0;

                return (
                  <li key={restaurant.id} className="restaurant-list-item">
                    <article
                      className="restaurant-card"
                      data-selected={selected}
                    >
                      <button
                        type="button"
                        className="restaurant-card-select"
                        aria-pressed={selected}
                        onClick={() => handleSelectRestaurant(restaurant.id)}
                      >
                        <span className="restaurant-card-topline">
                          <span className="category-badge">
                            {restaurant.categoryName}
                          </span>
                          {mode === "personal" && match?.status === "matched" && (
                            <span className="match-order-badge">매칭 {index + 1}번째</span>
                          )}
                          {hasCreatorVisit && (
                            <span className="creator-badge">영상 방문 확인</span>
                          )}
                        </span>
                        <strong>{restaurant.name}</strong>
                        <span className="restaurant-address">
                          {restaurant.roadAddress ?? restaurant.address ?? "주소 확인 중"}
                        </span>
                      </button>

                      {mode === "public" && summary && (
                        <ReactionDistribution summary={summary} />
                      )}
                      {mode === "personal" && match && (
                        <PersonalMatchSummary match={match} />
                      )}
                      <Link
                        href={`/restaurants/${restaurant.id}`}
                        className="restaurant-detail-link"
                      >
                        상세 보기 · 반응 남기기
                      </Link>
                    </article>
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
      </div>
    </section>
  );
}
