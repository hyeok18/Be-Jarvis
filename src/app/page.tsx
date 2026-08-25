import { MapExplorer } from "@/components/map/map-explorer";
import { PublicDataUnavailable } from "@/components/public-data/public-data-unavailable";
import { toMapExplorerData } from "@/components/public-data/public-restaurant-ui-adapter";
import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";

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

export default async function Home() {
  let data;

  try {
    const restaurants = await createConfiguredPublicRestaurantDependencies()
      .repository.list();
    data = toMapExplorerData(restaurants);
  } catch {
    return <PublicDataUnavailable retryHref="/" />;
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
          위치 기반 방문 확인을 통과한 공개 반응과 관리자가 확인한 영상 근거를
          보여줍니다. 위치 확인은 실제 식사를 보장하지 않습니다.
        </div>
      </section>

      <MapExplorer
        {...data}
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
