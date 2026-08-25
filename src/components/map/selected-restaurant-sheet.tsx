import Link from "next/link";

import type {
  Restaurant,
  RestaurantMatchResult,
  RestaurantReactionSummary,
} from "@/domain/types";

import type { CreatorVisitSource } from "./map-view-model";
import { PersonalMatchSummary } from "./personal-match-summary";
import { ReactionDistribution } from "./reaction-distribution";
import styles from "./selected-restaurant-sheet.module.css";

interface SelectedRestaurantSheetProps {
  restaurant: Restaurant;
  summary?: RestaurantReactionSummary;
  match?: RestaurantMatchResult;
  creatorSources: readonly CreatorVisitSource[];
  detailHrefSuffix?: string;
  onClose: () => void;
}

export function SelectedRestaurantSheet({
  restaurant,
  summary,
  match,
  creatorSources,
  detailHrefSuffix = "",
  onClose,
}: SelectedRestaurantSheetProps) {
  const firstCreatorSource = creatorSources[0];

  return (
    <aside
      className={styles.sheet}
      aria-label={`${restaurant.name} 선택 정보`}
      aria-live="polite"
    >
      <div className={styles.grabber} aria-hidden="true" />
      <header className={styles.heading}>
        <div>
          <span className={styles.category}>{restaurant.categoryName}</span>
          <h3>{restaurant.name}</h3>
          <p>{restaurant.roadAddress ?? restaurant.address ?? "주소 확인 중"}</p>
        </div>
        <button type="button" aria-label="선택한 식당 닫기" onClick={onClose}>
          ×
        </button>
      </header>

      <div className={styles.evidenceGrid}>
        {summary ? (
          <ReactionDistribution summary={summary} />
        ) : (
          <p className={styles.unavailable}>공개 반응을 불러오는 중입니다.</p>
        )}
        {match ? (
          <PersonalMatchSummary match={match} />
        ) : (
          <p className={styles.unavailable}>개인 매칭을 준비하고 있습니다.</p>
        )}
      </div>

      <div className={styles.creatorRow}>
        {firstCreatorSource ? (
          <a
            href={firstCreatorSource.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span aria-hidden="true">▶</span>
            <span>
              <strong>확인된 방문 영상 {creatorSources.length}개</strong>
              <small>{firstCreatorSource.channelTitle} 원본 보기</small>
            </span>
          </a>
        ) : (
          <p>아직 확인된 크리에이터 방문 영상이 없어요.</p>
        )}
      </div>

      <Link
        className={styles.detailLink}
        href={`/restaurants/${restaurant.id}${detailHrefSuffix}`}
      >
        식당 상세 · 반응 남기기
      </Link>
    </aside>
  );
}
