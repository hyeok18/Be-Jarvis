const foundationItems = [
  {
    title: "설명 가능한 점수",
    description: "맛 점수와 리뷰 신뢰도를 분리하고 조정 근거를 함께 보여줍니다.",
  },
  {
    title: "원본 데이터 보존",
    description: "합성 원본 리뷰와 분석 결과를 분리해 같은 버전으로 재계산합니다.",
  },
  {
    title: "안전한 배포 경계",
    description: "Supabase migration 검증 후 Vercel Preview를 거쳐 Production으로 승격합니다.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">성수동 · 24시간 해커톤 MVP</p>
        <h1 id="page-title">맛집 리뷰 신뢰도 지도</h1>
        <p className="lede">
          단순 평균 별점 대신 맛 점수와 리뷰 신뢰도를 함께 계산하고, 왜 점수가
          달라졌는지 설명하는 랭킹 서비스를 준비하고 있습니다.
        </p>
        <div className="notice" role="note">
          해커톤 데모용 합성 리뷰와 자동 분석 결과입니다. 실제 업체의 평가 또는 광고
          행위 판정이 아닙니다.
        </div>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div>
          <p className="eyebrow">구현 기반</p>
          <h2 id="foundation-title">먼저 지키는 세 가지 원칙</h2>
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
