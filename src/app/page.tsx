import { MapExplorer } from "@/components/map/map-explorer";
import { getFixtureMapExplorerData } from "@/components/map/map-explorer-fixture";
import { PublicDataUnavailable } from "@/components/public-data/public-data-unavailable";
import { toMapExplorerData } from "@/components/public-data/public-restaurant-ui-adapter";
import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";

import styles from "./page.module.css";

const foundationItems = [
  {
    title: "세 가지 반응",
    description: "좋아요, 그냥 그래요, 싫어요만 남겨 선택 부담을 줄입니다.",
  },
  {
    title: "나와의 매칭",
    description: "안 먹는 음식과 내 취향을 공개 반응과 섞지 않고 따로 계산합니다.",
  },
  {
    title: "영상 속 방문 근거",
    description: "확인된 맛집 탐방 영상과 최신 채널 출처를 지도에 연결합니다.",
  },
];

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ snapshot?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { snapshot } = await searchParams;
  const snapshotMode = snapshot === "1";
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
          <span className={styles.brandMark} aria-hidden="true">ㅈ</span>
          <span>
            <strong>쟤가 먹길래</strong>
            <small>반응과 영상 근거로 보는 성수 맛집</small>
          </span>
        </div>
        <span className={styles.locationBadge}>성수동</span>
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
        <div className={styles.heroCopy}>
          <p className="eyebrow">별점 없는 맛집 탐색</p>
          <h1 id="page-title">누가 다녀왔고, 내 취향에는 맞을까요?</h1>
          <p className={styles.lede}>
            방문 확인을 거친 세 반응과 내 취향 매칭, 관리자가 확인한 크리에이터
            영상을 한 지도에서 따로 살펴보세요.
          </p>
        </div>
        <div className={styles.heroFacts} aria-label="서비스 기준">
          <span><strong>3가지</strong> 공개 반응</span>
          <span><strong>{data.restaurants.length}곳</strong> 연결된 성수 식당</span>
          <span><strong>개별</strong> 영상 출처</span>
        </div>
        <div className={styles.notice} role="note">
          <strong>공개 반응 기준</strong>
          <span>
            위치 기반 방문 확인과 서버 검증을 통과한 반응만 표시합니다. 위치
            확인은 실제 식사를 보장하지 않습니다.
          </span>
        </div>
      </section>

      <MapExplorer
        {...data}
        detailHrefSuffix={snapshotMode ? "?snapshot=1" : ""}
      />

      <section className={styles.foundation} aria-labelledby="foundation-title">
        <div>
          <p className="eyebrow">구현 기반</p>
          <h2 id="foundation-title">새로운 선택 방식</h2>
        </div>
        <ul className={styles.cardGrid}>
          {foundationItems.map((item) => (
            <li key={item.title} className={styles.card}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
