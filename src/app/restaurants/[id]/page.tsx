"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { getMockCreatorEvidence, getMockRestaurant } from "../../../domain/mock-ui";

const REACTIONS = [
  ["like", "좋아요"],
  ["okay", "그냥 그래요"],
  ["dislike", "싫어요"],
] as const;

type ReactionKind = (typeof REACTIONS)[number][0];

export default function RestaurantDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const card = getMockRestaurant(params.id);
  const [reaction, setReaction] = useState<ReactionKind | null>(null);
  const [saved, setSaved] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  if (!card) {
    return (
      <main className="detail-shell detail-empty">
        <p className="eyebrow">맛집을 찾을 수 없음</p>
        <h1>아직 준비되지 않은 식당이에요.</h1>
        <Link className="detail-back-link" href="/">지도 화면으로 돌아가기</Link>
      </main>
    );
  }

  const { restaurant, reaction: summary, match } = card;
  const creatorEvidence = getMockCreatorEvidence(restaurant.id);
  const matchLabel = match.matchPercent === null ? "취향 설정 후 확인" : `${Math.round(match.matchPercent)}%`;

  return (
    <main className="detail-shell">
      <header className="detail-header">
        <button aria-label="지도 화면으로 돌아가기" className="icon-button" onClick={() => router.push("/")} type="button">‹</button>
        <span>맛집 상세</span>
        <button aria-label={saved ? "저장 취소" : "맛집 저장"} className={`icon-button save-button ${saved ? "is-saved" : ""}`} onClick={() => setSaved((value) => !value)} type="button">{saved ? "♥" : "♡"}</button>
      </header>

      <section className="detail-hero" aria-label="대표 음식 이미지">
        <span aria-hidden="true">🍜</span>
        <p>대표 메뉴 이미지</p>
      </section>

      <section className="detail-section detail-identity">
        <p className="detail-category">{restaurant.categoryName} · {restaurant.region}</p>
        <h1>{restaurant.name}</h1>
        <p>{restaurant.roadAddress ?? restaurant.address}</p>
        <strong className="open-status">● 영업 중 · 오늘 21:30까지</strong>
      </section>

      <section className="detail-section detail-evidence-grid">
        <div className="match-card">
          <p>나와의 예상 일치율</p>
          <strong>{matchLabel}</strong>
          <span>내 취향 기준 mock 결과</span>
        </div>
        <div className="reaction-summary" aria-label="방문 인증 반응 분포">
          <p>방문 인증 반응 {summary.countedTotal}개</p>
          {summary.countedTotal === 0 ? <span>아직 반응이 없어요.</span> : REACTIONS.map(([kind, label]) => <span key={kind}>{label} {summary.counts[kind as keyof typeof summary.counts]}개</span>)}
        </div>
      </section>

      <section className="detail-section reaction-input" aria-labelledby="reaction-title">
        <div className="section-heading"><h2 id="reaction-title">이 식당에 반응 남기기</h2><span>한 번의 탭</span></div>
        <div className="reaction-buttons">
          {REACTIONS.map(([kind, label]) => <button aria-pressed={reaction === kind} className={`reaction-button reaction-${kind} ${reaction === kind ? "is-selected" : ""}`} key={kind} onClick={() => setReaction(kind)} type="button">{label}</button>)}
        </div>
        <p className="visit-notice">{checkedIn ? "위치 기반 방문 확인이 완료됐어요. 공개 반응 반영 후보가 됩니다." : "방문 인증 전 반응은 나에게만 저장되며 공개 반응 집계에는 포함되지 않습니다."}</p>
        <button className={`checkin-button ${checkedIn ? "is-complete" : ""}`} onClick={() => setCheckedIn((value) => !value)} type="button">{checkedIn ? "방문 확인 완료" : "여기서 방문 체크인"}</button>
      </section>

      <section className="detail-section creator-section" aria-labelledby="creator-title">
        <div className="section-heading"><h2 id="creator-title">유튜버 방문 근거</h2><span>확인된 영상</span></div>
        {creatorEvidence.length === 0 ? <p className="empty-reactions">아직 확인된 크리에이터 영상 근거가 없어요.</p> : creatorEvidence.map((evidence) => <article className="creator-card" key={evidence.title}>
          <div className="creator-play" aria-hidden="true">▶</div>
          <div><strong>{evidence.title}</strong><p>{evidence.channelName} · {evidence.publishedLabel} · {evidence.subscriberLabel}</p></div>
          <a href={evidence.url} target="_blank" rel="noreferrer">원본 보기</a>
        </article>)}
      </section>

      <div className="detail-actions">
        <a className="primary-detail-action" href="https://www.youtube.com/" target="_blank" rel="noreferrer">방문 영상 보기</a>
        <a className="secondary-detail-action" href={`https://map.kakao.com/?q=${encodeURIComponent(restaurant.name)}`} target="_blank" rel="noreferrer">길찾기</a>
      </div>
    </main>
  );
}
