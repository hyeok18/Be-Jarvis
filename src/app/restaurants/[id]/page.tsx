import Link from "next/link";
import { notFound } from "next/navigation";

import { ReactionDistribution } from "@/components/map/reaction-distribution";
import { getKakaoPlaceHref } from "@/components/map/kakao-place-link";
import { CreatorEvidenceList } from "@/components/restaurant-detail/creator-evidence-list";
import { DetailMatchPanel } from "@/components/restaurant-detail/detail-match-panel";
import { ReactionSelector } from "@/components/restaurant-detail/reaction-selector";
import { getFixtureRestaurantDetail } from "@/components/restaurant-detail/restaurant-detail-view-model";
import { PublicDataUnavailable } from "@/components/public-data/public-data-unavailable";
import {
  toRestaurantDetailData,
  type RestaurantDetailData,
} from "@/components/public-data/public-restaurant-ui-adapter";
import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";

interface RestaurantDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ snapshot?: string }>;
}

export const dynamic = "force-dynamic";

export default async function RestaurantDetailPage({
  params,
  searchParams,
}: RestaurantDetailPageProps) {
  const { id } = await params;
  const { snapshot } = await searchParams;
  const snapshotMode = snapshot === "1";
  let detail: RestaurantDetailData | null;

  if (snapshotMode) {
    detail = getFixtureRestaurantDetail(id);
  } else {
    let publicRestaurant;

    try {
      publicRestaurant = await createConfiguredPublicRestaurantDependencies()
        .repository.getById(id);
    } catch {
      const encodedId = encodeURIComponent(id);
      return (
        <PublicDataUnavailable
          retryHref={`/restaurants/${encodedId}`}
          snapshotHref={`/restaurants/${encodedId}?snapshot=1`}
        />
      );
    }
    if (!publicRestaurant) notFound();
    detail = toRestaurantDetailData(publicRestaurant);
  }

  if (!detail) notFound();

  const {
    restaurant,
    reactionRestaurantId,
    reactionSummary,
    personalMatch,
    creatorVisitSources,
  } = detail;
  const address = restaurant.roadAddress ?? restaurant.address ?? "주소 확인 중";
  const kakaoSearchUrl = getKakaoPlaceHref(restaurant);

  return (
    <main className="restaurant-detail-page">
      <Link href="/" className="detail-back-link">
        ← 지도로 돌아가기
      </Link>

      <header className="detail-hero">
        <div className="restaurant-card-topline">
          <span className="category-badge">{restaurant.categoryName}</span>
          {creatorVisitSources.length > 0 && (
            <span className="creator-badge">영상 방문 확인</span>
          )}
        </div>
        <h1>{restaurant.name}</h1>
        <p>{address}</p>
        <a href={kakaoSearchUrl} target="_blank" rel="noopener noreferrer">
          카카오맵에서 위치 확인 ↗
        </a>
      </header>

      <div className="detail-demo-notice" role="note">
        {snapshotMode
          ? "발표 백업 모드의 합성 스냅샷입니다."
          : "공개 반응은 검증 집계만, 영상 근거는 최신 상태로 확인된 항목만 표시합니다."}
        실제 방문이나 식당 품질을 보장하지 않습니다.
      </div>

      <div className="detail-layout">
        <div className="detail-primary-column">
          <ReactionSelector
            restaurantId={restaurant.id}
            reactionRestaurantId={reactionRestaurantId}
          />
          <section className="detail-panel" aria-labelledby="public-reactions-title">
            <p className="eyebrow">공개 반응</p>
            <h2 id="public-reactions-title">방문 확인 반응 분포</h2>
            <ReactionDistribution summary={reactionSummary} />
          </section>
          <CreatorEvidenceList
            restaurantName={restaurant.name}
            sources={creatorVisitSources}
          />
        </div>

        <aside className="detail-side-column" aria-label="개인화 안내">
          <DetailMatchPanel match={personalMatch} />
        </aside>
      </div>
    </main>
  );
}
