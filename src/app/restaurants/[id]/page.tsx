import Link from "next/link";
import { notFound } from "next/navigation";

import { ReactionDistribution } from "@/components/map/reaction-distribution";
import { CreatorEvidenceList } from "@/components/restaurant-detail/creator-evidence-list";
import { DetailMatchPanel } from "@/components/restaurant-detail/detail-match-panel";
import { ReactionSelector } from "@/components/restaurant-detail/reaction-selector";
import { getFixtureRestaurantDetail } from "@/components/restaurant-detail/restaurant-detail-view-model";
import { DOMAIN_FIXTURE } from "@/domain/fixtures";

interface RestaurantDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return DOMAIN_FIXTURE.restaurants.map((restaurant) => ({ id: restaurant.id }));
}

export default async function RestaurantDetailPage({
  params,
}: RestaurantDetailPageProps) {
  const { id } = await params;
  const detail = getFixtureRestaurantDetail(id);

  if (!detail) notFound();

  const {
    restaurant,
    reactionRestaurantId,
    reactionSummary,
    personalMatch,
    creatorVisitSources,
  } = detail;
  const address = restaurant.roadAddress ?? restaurant.address ?? "주소 확인 중";
  const kakaoSearchUrl = `https://map.kakao.com/link/search/${encodeURIComponent(restaurant.name)}`;

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
        합성 식당·반응·영상 근거를 사용하는 화면입니다. 실제 방문이나 식당 품질을
        보장하지 않습니다.
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

        <aside className="detail-side-column" aria-label="개인화와 방문 확인 안내">
          <DetailMatchPanel match={personalMatch} />
          <section className="detail-panel visit-proof-panel" aria-labelledby="visit-proof-title">
            <p className="eyebrow">방문 확인</p>
            <h2 id="visit-proof-title">공개 반응 반영 조건</h2>
            <strong>현재 이 화면에서는 위치 체크인을 시작하지 않습니다.</strong>
            <p>
              위치 체크인으로 식당 근처 방문을 확인한 뒤에만 반응이 공개 집계 후보가
              됩니다. 체크인은 실제 식사까지 보장하지 않습니다.
            </p>
            <span>WU-10 위치 방문 증명 연결 예정</span>
          </section>
        </aside>
      </div>
    </main>
  );
}
