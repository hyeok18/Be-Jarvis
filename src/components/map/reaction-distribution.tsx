import type { CSSProperties } from "react";

import type { ReactionKind, RestaurantReactionSummary } from "@/domain/types";

import { getReactionDataState } from "./map-view-model";

interface ReactionDistributionProps {
  summary: RestaurantReactionSummary;
}

const REACTIONS: readonly {
  kind: ReactionKind;
  label: string;
  symbol: string;
}[] = [
  { kind: "like", label: "좋아요", symbol: "●" },
  { kind: "okay", label: "그냥 그래요", symbol: "▲" },
  { kind: "dislike", label: "싫어요", symbol: "■" },
];

export function ReactionDistribution({ summary }: ReactionDistributionProps) {
  const state = getReactionDataState(summary);

  return (
    <div className="reaction-distribution">
      <div className="reaction-distribution-heading">
        <span>방문 확인 공개 반응</span>
        <strong>{summary.countedTotal}명</strong>
      </div>

      <ul aria-label="좋아요, 그냥 그래요, 싫어요 공개 반응 분포">
        {REACTIONS.map(({ kind, label, symbol }) => {
          const percentage = summary.percentages?.[kind] ?? null;

          return (
            <li key={kind} className={`reaction-row reaction-${kind}`}>
              <span className="reaction-name">
                <i aria-hidden="true">{symbol}</i>
                {label}
              </span>
              <span className="reaction-count">{summary.counts[kind]}명</span>
              {percentage !== null && (
                <span className="reaction-track" aria-hidden="true">
                  <span
                    style={
                      { "--reaction-width": `${percentage}%` } as CSSProperties
                    }
                  />
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {state === "empty" && (
        <p className="reaction-data-note">아직 방문 확인 공개 반응이 없어요.</p>
      )}
      {state === "forming" && (
        <p className="reaction-data-note">
          반응을 모으는 중이에요. 10명이 모이기 전에는 참고용으로만 봐 주세요.
        </p>
      )}
    </div>
  );
}
