import Link from "next/link";
import { notFound } from "next/navigation";

import { ReactionDistribution } from "@/components/map/reaction-distribution";
import { PresentationSnapshotCycle } from "@/components/presentation/presentation-snapshot-cycle";
import { CreatorEvidenceList } from "@/components/restaurant-detail/creator-evidence-list";
import { DetailMatchPanel } from "@/components/restaurant-detail/detail-match-panel";
import { ReactionSelector } from "@/components/restaurant-detail/reaction-selector";
import { getFixtureRestaurantDetail } from "@/components/restaurant-detail/restaurant-detail-fixture";
import { PublicDataUnavailable } from "@/components/public-data/public-data-unavailable";
import { toRestaurantDetailData } from "@/components/public-data/public-restaurant-ui-adapter";
import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";

import styles from "./page.module.css";

interface RestaurantDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cycle?: string; snapshot?: string }>;
}

export const dynamic = "force-dynamic";

export default async function RestaurantDetailPage({
  params,
  searchParams,
}: RestaurantDetailPageProps) {
  const { id } = await params;
  const { cycle, snapshot } = await searchParams;
  const snapshotMode = snapshot === "1";
  const cycleMode = snapshotMode && cycle === "1";
  let detail;

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
  const kakaoSearchUrl = `https://map.kakao.com/link/search/${encodeURIComponent(restaurant.name)}`;
  const primaryCreatorSource = creatorVisitSources[0];

  return (
    <main className={`restaurant-detail-page ${styles.page}`}>
      <header className={styles.topBar}>
        <Link
          href={cycleMode ? "/?snapshot=1&cycle=1" : snapshotMode ? "/?snapshot=1" : "/"}
          className="detail-back-link"
          aria-label="지도로 돌아가기"
        >
          ←
        </Link>
        <strong>맛집 상세</strong>
        <span aria-hidden="true" />
      </header>

      <section className={`detail-hero ${styles.hero}`} aria-labelledby="restaurant-title">
        {snapshotMode ? (
          <div className="presentation-snapshot-notice" role="note">
            <strong>발표 백업 모드</strong>
            <span>
              합성 스냅샷 상세 화면입니다. 실제 DB·YouTube 성공 경로 검증은 키
              교체와 Preview 설정 후 재개합니다.
            </span>
          </div>
        ) : null}
        {cycleMode ? (
          <PresentationSnapshotCycle
            nextHref="/?snapshot=1&cycle=1"
            nextLabel="지도"
          />
        ) : null}
        <div className="restaurant-card-topline">
          <span className="category-badge">{restaurant.categoryName}</span>
          {creatorVisitSources.length > 0 && (
            <span className="creator-badge">영상 방문 확인</span>
          )}
        </div>
        <h1 id="restaurant-title">{restaurant.name}</h1>
        <p>{address}</p>
        <a href={kakaoSearchUrl} target="_blank" rel="noopener noreferrer">
          카카오맵에서 위치 확인 ↗
        </a>
      </section>

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

      <nav className={styles.actionBar} aria-label="식당 외부 링크">
        {primaryCreatorSource ? (
          <a
            className={styles.primaryAction}
            href={primaryCreatorSource.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            확인된 방문 영상 보기
          </a>
        ) : (
          <span className={styles.disabledAction}>확인된 방문 영상 없음</span>
        )}
        <a
          className={styles.secondaryAction}
          href={kakaoSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          길찾기
        </a>
      </nav>
    </main>
  );
}
