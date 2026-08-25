import Link from "next/link";
import { notFound } from "next/navigation";

import { ReactionDistribution } from "@/components/map/reaction-distribution";
import { CreatorEvidenceList } from "@/components/restaurant-detail/creator-evidence-list";
import { DetailMatchPanel } from "@/components/restaurant-detail/detail-match-panel";
import { ReactionSelector } from "@/components/restaurant-detail/reaction-selector";
import { PublicDataUnavailable } from "@/components/public-data/public-data-unavailable";
import { toRestaurantDetailData } from "@/components/public-data/public-restaurant-ui-adapter";
import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";

interface RestaurantDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function RestaurantDetailPage({
  params,
}: RestaurantDetailPageProps) {
  const { id } = await params;
  let publicRestaurant;

  try {
    publicRestaurant = await createConfiguredPublicRestaurantDependencies()
      .repository.getById(id);
  } catch {
    return <PublicDataUnavailable retryHref={`/restaurants/${encodeURIComponent(id)}`} />;
  }
  if (!publicRestaurant) notFound();
  const detail = toRestaurantDetailData(publicRestaurant);


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
        공개 반응은 위치 기반 방문 확인과 서버 검증을 통과한 집계만 보여줍니다. 위치
        확인은 실제 식사를 보장하지 않습니다.
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
