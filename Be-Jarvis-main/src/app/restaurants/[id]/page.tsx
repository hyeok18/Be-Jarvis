"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMockCreatorEvidence, getMockRestaurant } from "../../../domain/mock-ui";
import { calculateMeokbtiExpectedMatch, type MeokbtiAnswers } from "../../../domain/meokbti";

const PREFERENCES_STORAGE_KEY = "meokbti-preferences:v1";

const REACTIONS = [
  ["like", "좋아요", "😋"],
  ["okay", "그냥 그래요", "🙂"],
  ["dislike", "싫어요", "🙁"],
] as const;

type ReactionKind = (typeof REACTIONS)[number][0];

export default function RestaurantDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const card = getMockRestaurant(params.id);
  const [reaction, setReaction] = useState<ReactionKind | null>(null);
  const [saved, setSaved] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [savedPreferences, setSavedPreferences] = useState<MeokbtiAnswers | null>(null);
  useEffect(() => {
    const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (stored) {
      try { setSavedPreferences(JSON.parse(stored) as MeokbtiAnswers); } catch { window.localStorage.removeItem(PREFERENCES_STORAGE_KEY); }
    }
  }, []);

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
  const personalized = calculateMeokbtiExpectedMatch({ answers: savedPreferences, restaurantCategory: restaurant.categoryName, restaurantName: restaurant.name });
  const matchPercent = personalized.matchPercent ?? match.matchPercent;
  const matchLabel = matchPercent === null ? "취향 설정 후 확인" : `${Math.round(matchPercent)}%`;

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
          <span>{personalized.reason ?? "내 취향 기준 결과"}</span>
        </div>
        <div className="reaction-summary" aria-label="방문 인증 반응 분포">
          <p>방문 인증 반응 {summary.countedTotal}개</p>
          {summary.countedTotal === 0 ? <span>아직 반응이 없어요.</span> : REACTIONS.map(([kind, label, emoji]) => <span key={kind}>{emoji} {label} {summary.counts[kind as keyof typeof summary.counts]}개</span>)}
        </div>
      </section>

      <section className="detail-section reaction-input" aria-labelledby="reaction-title">
        <div className="reaction-intro"><span className="reaction-intro-icon" aria-hidden="true">💬</span><div><div className="section-heading"><h2 id="reaction-title">방문 후 생각을 남겨주세요</h2><span>한 번의 탭</span></div><p>직접 방문한 뒤 느낀 점을 가장 가까운 표정으로 골라주세요.</p></div></div>
        <div className="reaction-buttons">
          {REACTIONS.map(([kind, label, emoji]) => <button aria-pressed={reaction === kind} className={`reaction-button reaction-${kind} ${reaction === kind ? "is-selected" : ""}`} key={kind} onClick={() => setReaction((current) => current === kind ? null : kind)} type="button"><span aria-hidden="true">{emoji}</span><strong>{label}</strong><small>{reaction === kind ? "선택됨 · 다시 누르면 해제" : "탭해서 선택"}</small></button>)}
        </div>
        <div className={`visit-notice ${checkedIn ? "is-complete" : ""}`} role="status"><span aria-hidden="true">{checkedIn ? "✅" : "📍"}</span><p>{checkedIn ? "위치 기반 방문 확인이 완료됐어요. 이 반응은 공개 반영 후보가 됩니다." : "아직 방문 인증 전이에요. 먼저 체크인하면 내 반응이 공개 집계 후보가 됩니다."}</p></div>
        <button className={`checkin-button ${checkedIn ? "is-complete" : ""}`} onClick={() => setCheckedIn((value) => !value)} type="button"><span aria-hidden="true">{checkedIn ? "✅" : "📍"}</span>{checkedIn ? "방문 확인 완료" : "여기서 방문 체크인"}</button>
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
