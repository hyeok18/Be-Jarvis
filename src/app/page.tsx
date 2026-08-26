import { MapExplorer } from "@/components/map/map-explorer";
import { getFixtureMapExplorerData } from "@/components/map/map-explorer-fixture";
import { PublicDataUnavailable } from "@/components/public-data/public-data-unavailable";
import {
  toMapExplorerData,
  type MapExplorerData,
} from "@/components/public-data/public-restaurant-ui-adapter";
import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ snapshot?: string }>;
}

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

export default async function Home({ searchParams }: HomeProps) {
  const { snapshot } = await searchParams;
  const snapshotMode = snapshot === "1";
  let data: MapExplorerData;

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
    <main>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">성수동 · 24시간 해커톤 MVP</p>
        <h1 id="page-title">반응으로 보는 맛집 지도</h1>
        <p className="lede">
          복잡한 평가표 없이 세 반응을 남기고, 내 취향 매칭과 크리에이터의 영상
          방문 근거를 함께 살펴보는 지도를 준비하고 있습니다.
        </p>
        <div className="notice" role="note">
          {snapshotMode
            ? "발표 백업 모드입니다. 합성 스냅샷으로 지도 흐름을 확인할 수 있습니다."
            : "공개 반응은 방문 확인 집계만, 영상 근거는 최신 상태로 확인된 항목만 표시합니다."}
        </div>
      </section>

      <MapExplorer
        restaurants={data.restaurants}
        reactionSummaries={data.reactionSummaries}
        personalMatches={data.personalMatches}
        creatorVisitSources={data.creatorVisitSources}
      />

      <section className="foundation" aria-labelledby="foundation-title">
        <div>
          <p className="eyebrow">구현 기반</p>
          <h2 id="foundation-title">새로운 선택 방식</h2>
        </div>
        <ul className="card-grid">
          {foundationItems.map((item) => (
            <li key={item.title} className="card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
