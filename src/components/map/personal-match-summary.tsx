import type { MatchReasonCode, RestaurantMatchResult } from "@/domain/types";

interface PersonalMatchSummaryProps {
  match: RestaurantMatchResult;
}

const REASON_LABELS: Readonly<Partial<Record<MatchReasonCode, string>>> = {
  DIRECT_PREFERENCE: "직접 입력한 맛 취향",
  SIMILAR_USERS: "취향이 비슷한 사용자의 반응",
  VISIT_HISTORY: "이전 방문 만족 기록",
  COLD_START_CONTENT_ONLY: "입력한 취향만으로 계산 중",
};

export function PersonalMatchSummary({ match }: PersonalMatchSummaryProps) {
  if (match.status === "needs_preferences" || match.matchPercent === null) {
    return (
      <div className="personal-match-summary needs-preferences">
        <strong>취향 입력이 더 필요해요</strong>
        <p>선호하는 맛과 먹지 않는 음식을 입력하면 개인 매칭을 보여 드려요.</p>
      </div>
    );
  }

  if (match.status === "excluded") {
    return null;
  }

  const visibleReasons = match.reasons.filter(
    (reason) => reason !== "COLD_START_CONTENT_ONLY" && REASON_LABELS[reason],
  );
  const isColdStart = match.reasons.includes("COLD_START_CONTENT_ONLY");

  return (
    <div className="personal-match-summary">
      <div className="match-percent-row">
        <span>나와의 매칭</span>
        <strong>{match.matchPercent}%</strong>
      </div>
      <ul aria-label="개인 매칭에 사용한 근거">
        {visibleReasons.map((reason) => (
          <li key={reason}>{REASON_LABELS[reason]}</li>
        ))}
      </ul>
      {isColdStart && (
        <p className="match-data-note">
          비슷한 사용자와 방문 기록이 부족해 직접 입력한 취향만 반영했어요.
        </p>
      )}
    </div>
  );
}
