"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";

import { getMockCreatorEvidence, getMockRestaurantCards } from "../domain/mock-ui";

type MockCard = ReturnType<typeof getMockRestaurantCards>[number];

const FILTERS = ["전체", "한식", "해산물", "국수"] as const;
const PIN_POSITIONS = [
  { left: 168, top: 190 },
  { left: 78, top: 122 },
  { left: 278, top: 138 },
  { left: 108, top: 286 },
  { left: 302, top: 338 },
  { left: 44, top: 356 },
];

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

function ProfileView() {
  return <section className="app-subpage profile-view"><p className="subpage-eyebrow">내 정보</p><h1>나의 먹bti</h1><p>취향을 설정하면 맛집마다 예상 일치율을 더 정확하게 볼 수 있어요.</p><button type="button">취향 설정 시작하기</button><div className="profile-note"><strong>현재는 mock 프로필</strong><span>취향 설정과 로그인은 다음 단계에서 연결됩니다.</span></div></section>;
}

export default function Home() {
  const cards = useMemo(() => getMockRestaurantCards(), []);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(cards[0].restaurant.id);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("전체");
  const [searchAsMove, setSearchAsMove] = useState(true);
  const [activeNav, setActiveNav] = useState("지도");
  const [exploreQuery, setExploreQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([cards[0].restaurant.id]);

  const visibleCards = cards.filter(({ restaurant }) => activeFilter === "전체" || restaurant.categoryName === activeFilter);
  const selected = cards.find((card) => card.restaurant.id === selectedRestaurantId) ?? cards[0];
  const creatorEvidence = getMockCreatorEvidence(selected.restaurant.id);
  const selectedPinIndex = cards.findIndex((card) => card.restaurant.id === selected.restaurant.id);

  return (
    <main className="map-app-shell">
      <header className="map-app-header">
        <span className="status-time">9:41</span>
        <button className="location-selector" type="button">⌖ <strong>성수동</strong> <span>⌄</span></button>
      </header>

      {activeNav === "지도" ? <>
      <section className="map-stage" aria-label="성수동 맛집 지도">
        <div className="map-street street-a" aria-hidden="true" />
        <div className="map-street street-b" aria-hidden="true" />
        <div className="map-street street-c" aria-hidden="true" />
        <div className="map-street street-d" aria-hidden="true" />
        <div className="map-street street-e" aria-hidden="true" />
        <div className="map-street street-f" aria-hidden="true" />
        <span className="map-place place-forest">서울숲</span>
        <span className="map-place place-road">연무장길</span>
        <span className="map-place place-cafe">성수 카페거리</span>

        <div className="map-controls">
          <button className="search-map-toggle" aria-pressed={searchAsMove} onClick={() => setSearchAsMove((value) => !value)} type="button"><span>{searchAsMove ? "✓" : "○"}</span> 지도 움직이면 다시 검색</button>
          <button className="current-location-button" aria-label="현재 위치로 이동" onClick={() => window.alert("현재 위치를 기준으로 지도를 준비 중이에요.")} type="button">⌖</button>
        </div>

        <div className="filter-row" aria-label="음식 카테고리 필터">
          {FILTERS.map((filter) => <button className={activeFilter === filter ? "active" : ""} key={filter} onClick={() => setActiveFilter(filter)} type="button">{filter === "전체" ? "필터" : filter}</button>)}
        </div>

        {PIN_POSITIONS.map((position, index) => {
          const card = visibleCards[index % Math.max(visibleCards.length, 1)] ?? cards[index % cards.length];
          const isSelected = index === selectedPinIndex;
          return <button aria-label={`${card.restaurant.name} 선택`} className={`map-pin-button ${isSelected ? "selected" : ""}`} key={`${card.restaurant.id}-${index}`} onClick={() => setSelectedRestaurantId(card.restaurant.id)} style={{ left: position.left, top: position.top }} type="button"><Image src="/fork-pin-map-marker-v2.png" alt="" width={46} height={52} /></button>;
        })}
      </section>

      <section className="map-bottom-sheet" aria-label="선택한 맛집 정보">
        <div className="sheet-grabber" />
        <div className="sheet-title-row"><Link className="sheet-title-link" aria-label={`${selected.restaurant.name} 상세 페이지 열기`} href={`/restaurants/${selected.restaurant.id}`}><h1>{selected.restaurant.name}</h1></Link><Link aria-label="상세 페이지 열기" href={`/restaurants/${selected.restaurant.id}`}>♡</Link></div>
        <p className="sheet-meta">{selected.restaurant.categoryName} · 320m · 영업 중</p>
        <p className="sheet-creator">▶ {creatorEvidence.length ? "먹방 유튜버 3명이 추천 · 최근 방문 영상 5개" : "확인된 크리에이터 영상 근거 없음"}</p>
        <span className="sheet-match">나의 먹bti 예상 일치율 {formatMatch(selected.match.matchPercent)}</span>
        <p className="sheet-reactions-title">이 맛집에 대한 반응</p>
        <div className="sheet-reactions"><span className="reaction-chip like">좋아요 <b>{selected.reaction.counts.like}</b></span><span className="reaction-chip okay">그냥 그래요 <b>{selected.reaction.counts.okay}</b></span><span className="reaction-chip dislike">싫어요 <b>{selected.reaction.counts.dislike}</b></span></div>
        <div className="sheet-actions"><a className="sheet-primary-action" href="https://www.youtube.com/" target="_blank" rel="noreferrer">방문 영상 보기</a><a className="sheet-secondary-action" href={`https://map.kakao.com/?q=${encodeURIComponent(selected.restaurant.name)}`} target="_blank" rel="noreferrer">길찾기</a></div>
      </section>
      </> : activeNav === "탐색" ? <ExploreView cards={cards} query={exploreQuery} setQuery={setExploreQuery} onSelect={(id) => { setSelectedRestaurantId(id); setActiveNav("지도"); }} /> : activeNav === "저장" ? <SavedView cards={cards} savedIds={savedIds} onToggle={(id) => setSavedIds((current) => current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id])} /> : <ProfileView />}

      <nav className="map-bottom-nav" aria-label="하단 메뉴">
        {[["지도", "⌖"], ["탐색", "⌕"], ["저장", "♡"], ["내 정보", "●"]].map(([label, icon]) => <button className={activeNav === label ? "active" : ""} key={label} onClick={() => setActiveNav(label)} type="button"><span>{icon}</span>{label}</button>)}
      </nav>
    </main>
  );
}
