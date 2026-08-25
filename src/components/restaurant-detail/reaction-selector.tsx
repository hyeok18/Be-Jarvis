"use client";

import { useState, useSyncExternalStore } from "react";

import type { ReactionKind } from "@/domain/types";

import {
  readPrivateReaction,
  savePrivateReaction,
} from "./private-reaction-store";

interface ReactionSelectorProps {
  restaurantId: string;
}

const PRIVATE_REACTION_EVENT = "be-jarvis:private-reaction-change";

const REACTIONS: readonly {
  kind: ReactionKind;
  label: string;
  symbol: string;
}[] = [
  { kind: "like", label: "좋아요", symbol: "●" },
  { kind: "okay", label: "그냥 그래요", symbol: "▲" },
  { kind: "dislike", label: "싫어요", symbol: "■" },
];

export function ReactionSelector({ restaurantId }: ReactionSelectorProps) {
  const selectedKind = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener(PRIVATE_REACTION_EVENT, onStoreChange);

      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(PRIVATE_REACTION_EVENT, onStoreChange);
      };
    },
    () => readPrivateReaction(window.localStorage, restaurantId),
    () => null,
  );
  const [saveFailed, setSaveFailed] = useState(false);

  const selectReaction = (kind: ReactionKind) => {
    try {
      savePrivateReaction(window.localStorage, restaurantId, kind);
      setSaveFailed(false);
      window.dispatchEvent(new Event(PRIVATE_REACTION_EVENT));
    } catch {
      setSaveFailed(true);
    }
  };

  return (
    <section className="detail-panel reaction-input-panel" aria-labelledby="reaction-input-title">
      <div className="detail-panel-heading">
        <div>
          <p className="eyebrow">내 반응</p>
          <h2 id="reaction-input-title">한 번 탭해서 남겨 보세요</h2>
        </div>
        <span className="private-reaction-badge">이 기기에만 저장</span>
      </div>

      <div className="reaction-choice-grid" role="group" aria-label="내 반응 선택">
        {REACTIONS.map(({ kind, label, symbol }) => (
          <button
            key={kind}
            type="button"
            className={`reaction-choice reaction-choice-${kind}`}
            aria-pressed={selectedKind === kind}
            onClick={() => selectReaction(kind)}
          >
            <span aria-hidden="true">{symbol}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </div>

      <div className="private-reaction-notice" role="status" aria-live="polite">
        {!saveFailed && selectedKind !== null ? (
          <>
            <strong>내 취향에 저장했어요.</strong>
            <span>방문 확인 전이라 공개 반응에는 포함되지 않습니다.</span>
          </>
        ) : saveFailed ? (
          <>
            <strong>이 기기에 저장하지 못했어요.</strong>
            <span>브라우저 저장 설정을 확인한 뒤 다시 선택해 주세요.</span>
          </>
        ) : (
          <>
            <strong>지금 선택해도 공개 집계는 바뀌지 않아요.</strong>
            <span>방문 확인 기능은 후속 작업에서 연결합니다.</span>
          </>
        )}
      </div>
    </section>
  );
}
