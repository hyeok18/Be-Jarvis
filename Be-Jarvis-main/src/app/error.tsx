"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="state-shell">
      <p className="eyebrow">일시적인 오류</p>
      <h1>화면을 불러오지 못했습니다.</h1>
      <p>마지막으로 확인된 정보를 유지할 수 있도록 다시 시도해 주세요.</p>
      <button type="button" onClick={reset}>
        다시 시도
      </button>
    </main>
  );
}
