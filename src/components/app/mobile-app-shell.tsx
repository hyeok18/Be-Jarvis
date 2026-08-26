"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { preferenceAnswersToProfile, type PreferenceAnswers } from "@/domain/preference-matching";
import { calculateRestaurantMatch } from "@/domain/signals";
import type {
  Restaurant,
  RestaurantMatchResult,
  RestaurantReactionSummary,
} from "@/domain/types";

import { PresentationSnapshotCycle } from "../presentation/presentation-snapshot-cycle";
import type { MapExplorerData } from "../map/map-explorer-data";
import type { CreatorVisitSource } from "../map/map-view-model";
import { RestaurantMap } from "../map/restaurant-map";

import styles from "./mobile-app-shell.module.css";

type AppNav = "지도" | "탐색" | "저장" | "내 정보";
type PreferenceKey = "favorite" | "spicy" | "staple" | "avoid";

const PREFERENCES_STORAGE_KEY = "meokbti-preferences:v1";

function readStoredPreferences(): PreferenceAnswers | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as PreferenceAnswers;
  } catch {
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    return null;
  }
}

interface MobileAppShellProps extends MapExplorerData {
  detailHrefSuffix?: string;
  snapshotMode?: boolean;
  cycleMode?: boolean;
}

function matchLabel(match: RestaurantMatchResult | undefined) {
  if (!match || match.status !== "matched" || match.matchPercent === null) {
    return "취향 설정 후 확인";
  }

  return `${Math.round(match.matchPercent)}%`;
}

function addressOf(restaurant: Restaurant) {
  return restaurant.roadAddress ?? restaurant.address ?? "주소 확인 중";
}

function MobileSelectedSheet({
  restaurant,
  summary,
  match,
  creatorSources,
  detailHrefSuffix,
  onClose,
}: {
  restaurant: Restaurant;
  summary: RestaurantReactionSummary | undefined;
  match: RestaurantMatchResult | undefined;
  creatorSources: readonly CreatorVisitSource[];
  detailHrefSuffix: string;
  onClose: () => void;
}) {
  const primaryCreator = creatorSources[0];

  return (
    <section className={styles.bottomSheet} aria-label="선택한 맛집 정보">
      <div className={styles.sheetGrabber} aria-hidden="true" />
      <div className={styles.sheetTitleRow}>
        <Link
          className={styles.sheetTitleLink}
          href={`/restaurants/${restaurant.id}${detailHrefSuffix}`}
        >
          <h2>{restaurant.name}</h2>
        </Link>
        <div className={styles.sheetTitleActions}>
          <Link
            href={`/restaurants/${restaurant.id}${detailHrefSuffix}`}
            aria-label="상세 페이지 열기"
          >
            ♡
          </Link>
          <button type="button" aria-label="선택한 식당 닫기" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <p className={styles.sheetMeta}>
        {restaurant.categoryName} · {addressOf(restaurant)}
      </p>
      <p className={styles.sheetCreator}>
        ▶ {primaryCreator ? "확인된 크리에이터 방문 영상" : "확인된 크리에이터 영상 근거 없음"}
      </p>
      <span className={styles.sheetMatch}>나와의 매칭 {matchLabel(match)}</span>
      <p className={styles.sheetReactionsTitle}>방문 확인 반응</p>
      <div className={styles.sheetReactions} aria-label="방문 확인 반응 분포">
        {(["like", "okay", "dislike"] as const).map((kind) => {
          const labels = { like: "좋아요", okay: "그냥 그래요", dislike: "싫어요" };
          const classes = { like: styles.like, okay: styles.okay, dislike: styles.dislike };
          return (
            <span className={`${styles.reactionChip} ${classes[kind]}`} key={kind}>
              {labels[kind]} <b>{summary?.counts[kind] ?? 0}</b>
            </span>
          );
        })}
      </div>
      <div className={styles.sheetActions}>
        <Link
          className={styles.sheetPrimaryAction}
          href={`/restaurants/${restaurant.id}${detailHrefSuffix}`}
        >
          식당 더보기
        </Link>
        <a
          className={styles.sheetSecondaryAction}
          href={`https://map.kakao.com/?q=${encodeURIComponent(restaurant.name)}`}
          target="_blank"
          rel="noreferrer"
        >
          길찾기
        </a>
      </div>
    </section>
  );
}

function RestaurantCard({
  restaurant,
  summary,
  match,
  saved,
  onSelect,
  onToggleSaved,
}: {
  restaurant: Restaurant;
  summary: RestaurantReactionSummary | undefined;
  match: RestaurantMatchResult | undefined;
  saved: boolean;
  onSelect?: () => void;
  onToggleSaved?: () => void;
}) {
  return (
    <article className={styles.exploreCard}>
      <button className={styles.exploreCardMain} type="button" onClick={onSelect}>
        <span>{restaurant.categoryName}</span>
        <strong>{restaurant.name}</strong>
        <small>{addressOf(restaurant)}</small>
      </button>
      <div className={styles.exploreCardMeta}>
        <span>나와의 매칭 <b>{matchLabel(match)}</b></span>
        <span>반응 {summary?.countedTotal ?? 0}개</span>
      </div>
      {onToggleSaved ? (
        <button className={styles.saveButton} type="button" onClick={onToggleSaved}>
          {saved ? "저장 취소" : "♡ 저장"}
        </button>
      ) : null}
    </article>
  );
}

function PreferenceView({
  initialAnswers,
  onBack,
  onSave,
}: {
  initialAnswers: PreferenceAnswers | null;
  onBack: () => void;
  onSave: (answers: PreferenceAnswers) => void;
}) {
  const [answers, setAnswers] = useState<PreferenceAnswers>(initialAnswers ?? {});
  const questions: ReadonlyArray<readonly [PreferenceKey, string, readonly string[]]> = [
    ["favorite", "어떤 음식을 가장 좋아해요?", ["🍚 한식·찌개", "🍣 일식·초밥", "🍝 양식·파스타", "🍔 분식·간식"]],
    ["spicy", "매운 음식은 어때요?", ["🌶️ 아주 좋아요", "🙂 적당히 좋아요", "🥛 잘 못 먹어요"]],
    ["staple", "어떤 메뉴가 끌려요?", ["🍜 국물·면 요리", "🍛 밥·덮밥 요리", "🥩 고기·구이 요리", "🥗 샐러드·가벼운 요리"]],
    ["avoid", "피하고 싶은 음식이 있나요?", ["🙅 특별히 없어요", "🐟 해산물은 어려워요", "🥜 견과류를 피하고 싶어요", "🥦 채소를 별로 안 좋아해요", "🥩 고기를 별로 안 좋아해요"]],
  ];
  const answered = questions.filter(([key]) => answers[key]).length;

  return (
    <section className={`${styles.subpage} ${styles.preferenceView}`}>
      <button className={styles.preferenceBack} type="button" onClick={onBack}>
        ‹ 내 정보
      </button>
      <p>나의 먹BTI</p>
      <h1>내 취향을 알려주세요</h1>
      <p className={styles.preferenceLead}>선택한 답변으로 맛집마다 나와의 예상 일치율을 보여드릴게요.</p>
      {questions.map(([key, title, options]) => (
        <fieldset className={styles.preferenceQuestion} key={key}>
          <legend>{title}</legend>
          <div className={styles.preferenceOptions}>
            {options.map((option) => (
              <button
                className={answers[key] === option ? styles.selectedPreference : ""}
                key={option}
                type="button"
                aria-pressed={answers[key] === option}
                onClick={() => setAnswers((current) => {
                  if (current[key] === option) {
                    const next = { ...current };
                    delete next[key];
                    return next;
                  }
                  return { ...current, [key]: option };
                })}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <button
        className={styles.preferenceSave}
        type="button"
        disabled={answered < questions.length}
        onClick={() => onSave(answers)}
      >
        {answered < questions.length ? `${questions.length - answered}개 항목을 더 선택해주세요` : "취향 저장하기"}
      </button>
    </section>
  );
}

export function MobileAppShell({
  restaurants,
  reactionSummaries,
  personalMatches,
  restaurantProfiles,
  creatorVisitSources,
  detailHrefSuffix = "",
  snapshotMode = false,
  cycleMode = false,
}: MobileAppShellProps) {
  const [started, setStarted] = useState(false);
  const [activeNav, setActiveNav] = useState<AppNav>("지도");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [creatorOnly, setCreatorOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<readonly string[]>([]);
  const [savedPreferences, setSavedPreferences] = useState<PreferenceAnswers | null>(readStoredPreferences);
  const [preferenceOpen, setPreferenceOpen] = useState(false);

  const categories = useMemo(
    () => ["전체", ...Array.from(new Set(restaurants.map((restaurant) => restaurant.categoryName)))],
    [restaurants],
  );
  const summaryById = useMemo(
    () => new Map(reactionSummaries.map((summary) => [summary.restaurantId, summary])),
    [reactionSummaries],
  );
  const activePersonalMatches = useMemo(() => {
    const profile = preferenceAnswersToProfile(savedPreferences);
    if (!profile) return personalMatches;

    return restaurantProfiles.map((restaurantProfile) =>
      calculateRestaurantMatch({ profile, restaurant: restaurantProfile }),
    );
  }, [personalMatches, restaurantProfiles, savedPreferences]);
  const matchById = useMemo(
    () => new Map(activePersonalMatches.map((match) => [match.restaurantId, match])),
    [activePersonalMatches],
  );
  const creatorById = useMemo(() => {
    const result = new Map<string, CreatorVisitSource[]>();
    for (const source of creatorVisitSources) {
      result.set(source.restaurantId, [...(result.get(source.restaurantId) ?? []), source]);
    }
    return result;
  }, [creatorVisitSources]);
  const visibleRestaurants = useMemo(
    () => restaurants.filter((restaurant) => {
      const categoryMatches = selectedCategory === "전체" || restaurant.categoryName === selectedCategory;
      const creatorMatches = !creatorOnly || creatorById.has(restaurant.id);
      return categoryMatches && creatorMatches;
    }),
    [creatorById, creatorOnly, restaurants, selectedCategory],
  );
  const selectedRestaurant = selectedRestaurantId
    ? restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null
    : null;
  const handleSelectRestaurant = (restaurantId: string) => {
    setSelectedRestaurantId((current) => current === restaurantId ? null : restaurantId);
  };
  const savePreferences = (answers: PreferenceAnswers) => {
    setSavedPreferences(answers);
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(answers));
    setPreferenceOpen(false);
  };

  if (!started) {
    return (
      <main className={styles.welcomeShell}>
        <section className={styles.welcomeCard}>
          <Image
            className={styles.welcomeImage}
            src="/start-screen-user.png"
            alt=""
            fill
            priority
            sizes="(max-width: 492px) 100vw, 492px"
          />
          <h1 className={styles.srOnly}>쟤가 먹길래</h1>
          <button className={styles.welcomeStart} type="button" onClick={() => setStarted(true)}>
            <span className={styles.srOnly}>쟤가 먹길래 시작하기</span>
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.appShell}>
      <header className={styles.appHeader}>
        <span className={styles.statusTime}>성수동</span>
        <span className={styles.locationSelector}>맛집 지도⌄</span>
      </header>

      {activeNav === "지도" ? (
        <section className={styles.mapStage} aria-label="성수동 맛집 지도">
          <div className={styles.mapControls}>
            <span className={styles.searchMapToggle}>⌕ 지도에서 맛집 찾기</span>
            <button className={styles.currentLocationButton} type="button" aria-label="현재 위치 기준 지도 준비">
              ⌖
            </button>
          </div>
          <div className={styles.filterRow} aria-label="음식 카테고리 필터">
            {categories.map((category) => (
              <button
                className={category !== "전체" && category === selectedCategory ? styles.activeFilter : ""}
                key={category}
                type="button"
                aria-pressed={category === selectedCategory}
                onClick={() => {
                  setSelectedCategory((current) => category === "전체" || current === category ? "전체" : category);
                  setSelectedRestaurantId(null);
                }}
              >
                {category === "전체" ? "필터" : category}
              </button>
            ))}
            <button
              className={creatorOnly ? styles.activeFilter : ""}
              type="button"
              aria-pressed={creatorOnly}
              onClick={() => setCreatorOnly((active) => !active)}
            >
              영상 방문
            </button>
          </div>
          <div className={styles.mapPanel}>
            {snapshotMode ? (
              <div className={styles.snapshotNotice} role="note">
                <strong>발표 백업 모드</strong>
                <span>합성 스냅샷으로 화면 흐름만 시연합니다.</span>
              </div>
            ) : null}
            {cycleMode ? (
              <PresentationSnapshotCycle nextHref="/restaurants/restaurant-balanced-bowl?snapshot=1&cycle=1" nextLabel="상세" />
            ) : null}
            <RestaurantMap
              restaurants={visibleRestaurants}
              selectedRestaurantId={selectedRestaurantId}
              creatorVisitSources={creatorVisitSources}
              onSelectRestaurant={handleSelectRestaurant}
            />
            {selectedRestaurant ? (
              <MobileSelectedSheet
                restaurant={selectedRestaurant}
                summary={summaryById.get(selectedRestaurant.id)}
                match={matchById.get(selectedRestaurant.id)}
                creatorSources={creatorById.get(selectedRestaurant.id) ?? []}
                detailHrefSuffix={detailHrefSuffix}
                onClose={() => setSelectedRestaurantId(null)}
              />
            ) : (
              <div className={styles.selectionHint} role="status">
                <strong>지도에서 맛집을 선택해보세요</strong>
                <span>마커를 누르면 상세 정보를 볼 수 있어요</span>
              </div>
            )}
          </div>
        </section>
      ) : activeNav === "탐색" ? (
        <section className={styles.subpage}>
          <div className={styles.subpageHeading}><div><p>성수동 · 맛집 탐색</p><h1>어디로 갈까요?</h1></div><span>{restaurants.length}곳</span></div>
          <label className={styles.exploreSearch}><span>⌕</span><input aria-label="맛집 검색" placeholder="지역·음식점 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className={styles.exploreList}>
            {restaurants.filter((restaurant) => restaurant.name.includes(query) || restaurant.categoryName.includes(query)).map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} summary={summaryById.get(restaurant.id)} match={matchById.get(restaurant.id)} saved={savedIds.includes(restaurant.id)} onSelect={() => { setSelectedRestaurantId(restaurant.id); setActiveNav("지도"); }} onToggleSaved={() => setSavedIds((current) => current.includes(restaurant.id) ? current.filter((id) => id !== restaurant.id) : [...current, restaurant.id])} />
            ))}
          </div>
        </section>
      ) : activeNav === "저장" ? (
        <section className={styles.subpage}>
          <div className={styles.subpageHeading}><div><p>내가 저장한 맛집</p><h1>다시 가고 싶은 곳</h1></div><span>{savedIds.length}곳</span></div>
          {savedIds.length === 0 ? <div className={styles.savedEmpty}><span>♡</span><h2>아직 저장한 맛집이 없어요.</h2><p>지도나 탐색에서 마음에 드는 맛집을 저장해보세요.</p></div> : <div className={styles.exploreList}>{restaurants.filter((restaurant) => savedIds.includes(restaurant.id)).map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} summary={summaryById.get(restaurant.id)} match={matchById.get(restaurant.id)} saved onSelect={() => { setSelectedRestaurantId(restaurant.id); setActiveNav("지도"); }} onToggleSaved={() => setSavedIds((current) => current.filter((id) => id !== restaurant.id))} />)}</div>}
        </section>
      ) : preferenceOpen ? (
        <PreferenceView
          initialAnswers={savedPreferences}
          onBack={() => setPreferenceOpen(false)}
          onSave={savePreferences}
        />
      ) : (
        <section className={styles.subpage}>
          <p>내 정보</p><h1>나의 먹BTI</h1><p className={styles.profileLead}>취향을 설정하면 맛집마다 나와의 매칭을 확인할 수 있어요.</p>
          <button className={styles.preferenceStart} type="button" onClick={() => setPreferenceOpen(true)}>
            {savedPreferences ? "취향 다시 설정하기" : "취향 설정 시작하기"}
          </button>
          {savedPreferences ? (
            <div className={styles.savedPreferenceCard}>
              <strong>저장된 내 취향</strong>
              <span>{savedPreferences.favorite}</span>
              <span>{savedPreferences.spicy} · {savedPreferences.staple}</span>
              <span>{savedPreferences.avoid}</span>
            </div>
          ) : (
            <div className={styles.profileNote}><strong>아직 취향이 저장되지 않았어요</strong><span>간단한 질문에 답하고 나에게 맞는 맛집을 찾아보세요.</span></div>
          )}
        </section>
      )}

      <nav className={styles.bottomNav} aria-label="하단 메뉴">
        {(["지도", "탐색", "저장", "내 정보"] as const).map((label) => (
          <button className={activeNav === label ? styles.activeNav : ""} key={label} type="button" onClick={() => setActiveNav(label)}>
            <span aria-hidden="true">{label === "지도" ? "🗺️" : label === "탐색" ? "🔎" : label === "저장" ? "💖" : "👤"}</span>{label}
          </button>
        ))}
      </nav>
    </main>
  );
}
