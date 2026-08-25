export default function Loading() {
  return (
    <main className="state-shell" aria-live="polite" aria-busy="true">
      <p className="eyebrow">불러오는 중</p>
      <h1>랭킹 기반을 준비하고 있습니다.</h1>
      <div className="skeleton" aria-hidden="true" />
    </main>
  );
}
