import { MapExplorer } from "@/components/map/map-explorer";
import { getFixtureMapExplorerData } from "@/components/map/map-explorer-fixture";
import { PresentationSnapshotCycle } from "@/components/presentation/presentation-snapshot-cycle";
import { PublicDataUnavailable } from "@/components/public-data/public-data-unavailable";
import { toMapExplorerData } from "@/components/public-data/public-restaurant-ui-adapter";
import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ cycle?: string; snapshot?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { cycle, snapshot } = await searchParams;
  const snapshotMode = snapshot === "1";
  const cycleMode = snapshotMode && cycle === "1";
  const detailHrefSuffix = cycleMode ? "?snapshot=1&cycle=1" : snapshotMode ? "?snapshot=1" : "";
  let data;

  if (snapshotMode) {
    data = getFixtureMapExplorerData();
  } else {
    try {
      const restaurants = await createConfiguredPublicRestaurantDependencies()
        .repository.list();
      data = toMapExplorerData(restaurants);
    } catch {
      return <PublicDataUnavailable retryHref="/" snapshotHref="/?snapshot=1" />;
    }
  }

  return (
    <main className={styles.pageShell}>
      <header className={styles.appHeader}>
        <div>
          <span className={styles.brandMark} aria-hidden="true">🍴</span>
          <span>
            <strong>쟤가 먹길래</strong>
            <small>성수동 맛집 지도</small>
          </span>
        </div>
        <span className={styles.locationBadge}>성수동 · 지도</span>
      </header>

      <section className={styles.hero} aria-labelledby="page-title">
        {snapshotMode ? (
          <div className="presentation-snapshot-notice" role="note">
            <strong>발표 백업 모드</strong>
            <span>
              Supabase·YouTube·Preview 연결 없이 합성 스냅샷으로 화면 흐름만
              시연합니다. 실제 공개 데이터 연결은 나중 구현에서 재개합니다.
            </span>
          </div>
        ) : null}
        {cycleMode ? (
          <PresentationSnapshotCycle
            nextHref="/restaurants/restaurant-balanced-bowl?snapshot=1&cycle=1"
            nextLabel="상세"
          />
        ) : null}
        <div className={styles.heroCopy}>
          <p className="eyebrow">성수 맛집 탐색</p>
          <h1 id="page-title">지도로 바로 찾아보세요.</h1>
          <p className={styles.lede}>
            공개 반응, 내 취향, 확인된 영상 근거를 서로 섞지 않고 살펴볼 수 있어요.
          </p>
        </div>
        <span className={styles.restaurantCount}>{data.restaurants.length}곳 연결됨</span>
      </section>

      <MapExplorer
        {...data}
        detailHrefSuffix={detailHrefSuffix}
      />

    </main>
  );
}
