"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { getMockCreatorEvidence, getMockRestaurantCards } from "../domain/mock-ui";
import { calculateMeokbtiExpectedMatch, type MeokbtiAnswers } from "../domain/meokbti";
import { KakaoMap } from "../components/map/kakao-map";

type MockCard = ReturnType<typeof getMockRestaurantCards>[number];

const FILTERS = ["전체", "한식", "해산물", "국수"] as const;
const PIN_POSITIONS = [
  { left: 168, top: 190 },
  { left: 78, top: 122 },
  { left: 278, top: 138 },
  { left: 108, top: 286 },
  { left: 302, top: 338 },
  { left: 44, top: 356 },
  { left: 208, top: 92 },
  { left: 338, top: 218 },
  { left: 150, top: 148 },
  { left: 24, top: 228 },
  { left: 226, top: 262 },
  { left: 348, top: 80 },
  { left: 12, top: 332 },
  { left: 188, top: 350 },
  { left: 256, top: 182 },
  { left: 92, top: 382 },
];
const PREFERENCES_STORAGE_KEY = "meokbti-preferences:v1";

function formatMatch(value: number | null) {
  return value === null ? "취향 설정 후 확인" : `${Math.round(value)}%`;
}

function ExploreView({ cards, query, setQuery, onSelect }: { cards: MockCard[]; query: string; setQuery: (value: string) => void; onSelect: (id: string) => void }) {
  const filtered = cards.filter(({ restaurant }) => restaurant.name.toLowerCase().includes(query.toLowerCase()) || restaurant.categoryName.includes(query));
  return <section className="app-subpage"><div className="subpage-heading"><div><p className="subpage-eyebrow">성수동 · 맛집 탐색</p><h1>어디로 갈까요?</h1></div><span>{filtered.length}곳</span></div><label className="explore-search"><span>⌕</span><input aria-label="맛집 검색" onChange={(event) => setQuery(event.target.value)} placeholder="지역·음식점 검색" value={query} /></label><div className="explore-filter-row"><button className="active" type="button">전체</button><button type="button">한식</button><button type="button">카페</button><button type="button">국수</button></div><div className="explore-list">{filtered.map(({ restaurant, match, reaction }) => <article className="explore-card" key={restaurant.id}><button className="explore-card-main" onClick={() => onSelect(restaurant.id)} type="button"><span>{restaurant.categoryName}</span><strong>{restaurant.name}</strong><small>{restaurant.roadAddress}</small></button><div className="explore-card-meta"><span>나와의 일치율 <b>{formatMatch(match.matchPercent)}</b></span><span>반응 {reaction.countedTotal}개</span></div><Link href={`/restaurants/${restaurant.id}`}>상세 보기 →</Link></article>)}</div></section>;
}

function SavedView({ cards, savedIds, onToggle }: { cards: MockCard[]; savedIds: string[]; onToggle: (id: string) => void }) {
  const savedCards = cards.filter(({ restaurant }) => savedIds.includes(restaurant.id));
  return <section className="app-subpage"><div className="subpage-heading"><div><p className="subpage-eyebrow">내가 저장한 맛집</p><h1>다시 가고 싶은 곳</h1></div><span>{savedCards.length}곳</span></div>{savedCards.length === 0 ? <div className="saved-empty"><span>♡</span><h2>아직 저장한 맛집이 없어요.</h2><p>지도나 탐색에서 마음에 드는 맛집을 저장해보세요.</p></div> : <div className="explore-list">{savedCards.map(({ restaurant, match, reaction }) => <article className="explore-card saved-card" key={restaurant.id}><Link className="explore-card-main" href={`/restaurants/${restaurant.id}`}><span>{restaurant.categoryName}</span><strong>{restaurant.name}</strong><small>{restaurant.roadAddress}</small></Link><div className="explore-card-meta"><span>예상 일치율 <b>{formatMatch(match.matchPercent)}</b></span><span>반응 {reaction.countedTotal}개</span></div><button className="unsave-button" onClick={() => onToggle(restaurant.id)} type="button">저장 취소</button></article>)}</div>}</section>;
}

function PreferenceView({ initialAnswers, onBack, onSave }: { initialAnswers: MeokbtiAnswers | null; onBack: () => void; onSave: (answers: MeokbtiAnswers) => void }) {
  const [answers, setAnswers] = useState<MeokbtiAnswers>(initialAnswers ?? {});
  const questions = [
    ["favorite", "어떤 음식을 가장 좋아해요?", ["🍚 한식·찌개", "🍣 일식·초밥", "🍝 양식·파스타", "🍔 분식·간식"]],
    ["spicy", "매운 음식은 어때요?", ["🌶️ 아주 좋아요", "🙂 적당히 좋아요", "🥛 잘 못 먹어요"]],
    ["staple", "어떤 메뉴가 끌려요?", ["🍜 국물·면 요리", "🍛 밥·덮밥 요리", "🥩 고기·구이 요리", "🥗 샐러드·가벼운 요리"]],
    ["avoid", "피하고 싶은 음식이 있나요?", ["🙅 특별히 없어요", "🐟 해산물은 어려워요", "🥜 견과류를 피하고 싶어요", "🥦 채소를 별로 안 좋아해요", "🥩 고기를 별로 안 좋아해요"]],
  ];
  return <section className="app-subpage preference-view"><button className="preference-back" onClick={onBack} type="button">‹ 내 정보</button><p className="subpage-eyebrow">나의 먹BTI</p><h1>내 취향을 알려주세요</h1><p className="preference-lead">선택한 답변으로 맛집마다 나와의 예상 일치율을 보여드릴게요.</p>{questions.map(([key, title, options]) => <fieldset className="preference-question" key={key}><legend>{title}</legend><div className="preference-options">{(options as string[]).map((option) => <button className={answers[key] === option ? "selected" : ""} key={option} onClick={() => setAnswers((current) => { if (current[key] === option) { const next = { ...current }; delete next[key]; return next; } return { ...current, [key]: option }; })} type="button">{option}</button>)}</div></fieldset>)}<button className="preference-save" disabled={Object.keys(answers).length < questions.length} onClick={() => onSave(answers)} type="button">{Object.keys(answers).length < questions.length ? "모든 항목을 선택해주세요" : "취향 저장하기"}</button></section>;
}

function ProfileView({ preferences, onStartPreference }: { preferences: MeokbtiAnswers | null; onStartPreference: () => void }) {
  return <section className="app-subpage profile-view"><p className="subpage-eyebrow">내 정보</p><h1>나의 먹bti</h1><p>취향을 설정하면 맛집마다 예상 일치율을 더 정확하게 볼 수 있어요.</p><button onClick={onStartPreference} type="button">{preferences ? "취향 다시 설정하기" : "취향 설정 시작하기"}</button>{preferences ? <div className="saved-preference-card"><strong>저장된 내 취향</strong><span>{preferences.favorite}</span><span>{preferences.spicy} · {preferences.staple}</span><span>{preferences.avoid}</span></div> : <div className="profile-note"><strong>아직 취향이 저장되지 않았어요</strong><span>간단한 질문에 답하고 나에게 맞는 맛집을 찾아보세요.</span></div>}</section>;
}

export default function Home() {
  const baseCards = useMemo(() => getMockRestaurantCards(), []);
  const [savedPreferences, setSavedPreferences] = useState<MeokbtiAnswers | null>(null);
  const cards = useMemo(() => baseCards.map((card) => {
    const personalized = calculateMeokbtiExpectedMatch({ answers: savedPreferences, restaurantCategory: card.restaurant.categoryName, restaurantName: card.restaurant.name });
    return personalized.matchPercent === null ? card : { ...card, match: { ...card.match, matchPercent: personalized.matchPercent } };
  }), [baseCards, savedPreferences]);
  useEffect(() => {
    const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (stored) {
      try { setSavedPreferences(JSON.parse(stored) as MeokbtiAnswers); } catch { window.localStorage.removeItem(PREFERENCES_STORAGE_KEY); }
    }
  }, []);
  const [started, setStarted] = useState(false);
  // 지도는 처음 열었을 때 아무 식당도 선택하지 않은 상태로 시작합니다.
  // 마커를 누르면 선택되고, 선택된 카드의 닫기 버튼으로 다시 지도만 볼 수 있습니다.
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("전체");
  const [activeNav, setActiveNav] = useState("지도");
  const [exploreQuery, setExploreQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [preferenceOpen, setPreferenceOpen] = useState(false);

  const visibleCards = cards.filter(({ restaurant }) => activeFilter === "전체" || restaurant.categoryName === activeFilter);
  const selected = selectedRestaurantId ? cards.find((card) => card.restaurant.id === selectedRestaurantId) ?? null : null;
  const creatorEvidence = selected ? getMockCreatorEvidence(selected.restaurant.id) : [];
  const selectedMatchEvidence = selected ? calculateMeokbtiExpectedMatch({ answers: savedPreferences, restaurantCategory: selected.restaurant.categoryName, restaurantName: selected.restaurant.name }) : null;

  const savePreferences = (answers: MeokbtiAnswers) => {
    setSavedPreferences(answers);
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(answers));
    setPreferenceOpen(false);
  };

  if (!started) {
    return <main className="welcome-shell"><section className="welcome-card figma-start-card"><Image className="figma-start-image" src="/food-creator-hero-v2.png" alt="음식을 소개하는 크리에이터" fill priority sizes="(max-width: 390px) 100vw, 390px" /><h1 className="figma-start-title">쟤가 먹길래</h1><button className="welcome-start" onClick={() => setStarted(true)} type="button"><span>›</span><strong>쟤가 먹길래 시작하기</strong></button></section></main>;
  }

  return (
    <main className="map-app-shell">
      <header className="map-app-header">
      </header>

      {activeNav === "지도" ? <>
      <section className="map-stage" aria-label="성수동 맛집 지도">
        <KakaoMap />

        <div className="map-controls">
          <button className="current-location-button" aria-label="현재 위치로 이동" onClick={() => window.alert("현재 위치를 기준으로 지도를 준비 중이에요.")} type="button">⌖</button>
        </div>

        <div className="filter-row" aria-label="음식 카테고리 필터">
          {FILTERS.map((filter) => <button className={filter !== "전체" && activeFilter === filter ? "active" : ""} key={filter} onClick={() => { setActiveFilter((current) => filter === "전체" || current === filter ? "전체" : filter); setSelectedRestaurantId(null); }} type="button">{filter === "전체" ? "필터" : filter}</button>)}
        </div>

        {visibleCards.map((card, index) => {
          const position = PIN_POSITIONS[index % PIN_POSITIONS.length];
          const isSelected = selected?.restaurant.id === card.restaurant.id;
          return <button aria-label={`${card.restaurant.name} ${isSelected ? "선택 해제" : "선택"}`} className={`map-pin-button ${isSelected ? "selected" : ""}`} key={card.restaurant.id} onClick={() => setSelectedRestaurantId((current) => current === card.restaurant.id ? null : card.restaurant.id)} style={{ left: position.left, top: position.top }} type="button"><Image src="/fork-pin-map-marker-v2.png" alt="" width={46} height={52} /></button>;
        })}
        {visibleCards.length === 0 && activeFilter !== "전체" && <div className="map-filter-empty" role="status">이 카테고리의 맛집이 아직 없어요.</div>}
        {!selected && <div className="map-selection-hint" role="status"><strong>지도에서 맛집을 선택해보세요</strong><span>포크 마커를 누르면 상세 정보를 볼 수 있어요</span></div>}
      </section>

      {selected && <section className="map-bottom-sheet" aria-label="선택한 맛집 정보">
        <div className="sheet-grabber" />
        <div className="sheet-title-row"><Link className="sheet-title-link" aria-label={`${selected.restaurant.name} 상세 페이지 열기`} href={`/restaurants/${selected.restaurant.id}`}><h1>{selected.restaurant.name}</h1></Link><div className="sheet-title-actions"><Link aria-label="상세 페이지 열기" href={`/restaurants/${selected.restaurant.id}`}>♡</Link><button aria-label="선택한 식당 닫기" onClick={() => setSelectedRestaurantId(null)} type="button">×</button></div></div>
        <p className="sheet-meta">{selected.restaurant.categoryName} · 320m · 영업 중</p>
        <p className="sheet-creator">▶ {creatorEvidence.length ? "먹방 유튜버 3명이 추천 · 최근 방문 영상 5개" : "확인된 크리에이터 영상 근거 없음"}</p>
        <span className="sheet-match">나의 먹bti 예상 일치율 {formatMatch(selected.match.matchPercent)}</span>
        {savedPreferences && selectedMatchEvidence?.reason && <p className="sheet-match-evidence">{selectedMatchEvidence.reason}</p>}
        <p className="sheet-reactions-title">이 맛집에 대한 반응</p>
        <div className="sheet-reactions"><span className="reaction-chip like">좋아요 <b>{selected.reaction.counts.like}</b></span><span className="reaction-chip okay">그냥 그래요 <b>{selected.reaction.counts.okay}</b></span><span className="reaction-chip dislike">싫어요 <b>{selected.reaction.counts.dislike}</b></span></div>
        <div className="sheet-actions"><Link className="sheet-primary-action" href={`/restaurants/${selected.restaurant.id}`}>식당 더보기</Link><a className="sheet-secondary-action" href={`https://map.kakao.com/?q=${encodeURIComponent(selected.restaurant.name)}`} target="_blank" rel="noreferrer">길찾기</a></div>
      </section>}
      </> : activeNav === "탐색" ? <ExploreView cards={cards} query={exploreQuery} setQuery={setExploreQuery} onSelect={(id) => { setSelectedRestaurantId(id); setActiveNav("지도"); }} /> : activeNav === "저장" ? <SavedView cards={cards} savedIds={savedIds} onToggle={(id) => setSavedIds((current) => current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id])} /> : preferenceOpen ? <PreferenceView initialAnswers={savedPreferences} onBack={() => setPreferenceOpen(false)} onSave={savePreferences} /> : <ProfileView preferences={savedPreferences} onStartPreference={() => setPreferenceOpen(true)} />}

      <nav className="map-bottom-nav" aria-label="하단 메뉴">
        {[["지도", "⌖"], ["탐색", "⌕"], ["저장", "♡"], ["내 정보", "●"]].map(([label, icon]) => <button className={activeNav === label ? "active" : ""} key={label} onClick={() => setActiveNav(label)} type="button"><span>{icon}</span>{label}</button>)}
      </nav>
    </main>
  );
}
