import type { RestaurantMatchResult } from "@/domain/types";

import { formatFoodTag } from "../map/map-view-model";
import { PersonalMatchSummary } from "../map/personal-match-summary";

interface DetailMatchPanelProps {
  match: RestaurantMatchResult;
}

export function DetailMatchPanel({ match }: DetailMatchPanelProps) {
  return (
    <section className="detail-panel" aria-labelledby="detail-match-title">
      <p className="eyebrow">개인화</p>
      <h2 id="detail-match-title">나와의 매칭</h2>
      {match.status === "excluded" ? (
        <div className="detail-match-excluded" role="note">
          <strong>먹지 않는 음식 설정으로 매칭 후보에서 제외했어요.</strong>
          <span>
            설정된 제외 음식: {match.excludedFoodTags.map(formatFoodTag).join(", ")}
          </span>
          <small>제외 설정을 해제하면 개인 매칭을 다시 계산합니다.</small>
        </div>
      ) : (
        <PersonalMatchSummary match={match} />
      )}
      <p className="detail-disclaimer">
        개인 매칭은 내 취향 탐색을 위한 값이며 공개 반응 분포나 식당 품질 순위가
        아닙니다.
      </p>
    </section>
  );
}
