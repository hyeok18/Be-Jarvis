import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreatorEvidenceList } from "../src/components/restaurant-detail/creator-evidence-list";
import { DetailMatchPanel } from "../src/components/restaurant-detail/detail-match-panel";
import {
  PRIVATE_REACTION_STORAGE_KEY,
  readPrivateReaction,
  savePrivateReaction,
} from "../src/components/restaurant-detail/private-reaction-store";
import { ReactionSelector } from "../src/components/restaurant-detail/reaction-selector";
import { getReactionRestaurantId } from "../src/components/restaurant-detail/reaction-restaurant-map";
import { getFixtureRestaurantDetail } from "../src/components/restaurant-detail/restaurant-detail-fixture";

describe("restaurant detail view model", () => {
  it("exposes only confirmed, fresh creator evidence in subscriber order", () => {
    const detail = getFixtureRestaurantDetail("restaurant-balanced-bowl");

    expect(detail?.creatorVisitSources.map((source) => source.videoId)).toEqual([
      "synthetic-large-video",
      "synthetic-small-video",
      "synthetic-hidden-video",
    ]);
    expect(detail?.creatorVisitSources.map((source) => source.videoId)).not.toContain(
      "synthetic-candidate-video",
    );
    expect(detail?.creatorVisitSources.map((source) => source.videoId)).not.toContain(
      "synthetic-stale-video",
    );
  });

  it("returns null for an unknown restaurant id", () => {
    expect(getFixtureRestaurantDetail("unknown-restaurant")).toBeNull();
  });

  it("maps UI fixture slugs to seeded database UUIDs", () => {
    expect(getReactionRestaurantId("restaurant-balanced-bowl")).toBe(
      "10000000-0000-4000-8000-000000000001",
    );
    expect(getReactionRestaurantId("unknown-restaurant")).toBeNull();
    expect(
      getFixtureRestaurantDetail("restaurant-green-table")?.reactionRestaurantId,
    ).toBe("10000000-0000-4000-8000-000000000003");
  });
});

describe("one-tap private reaction", () => {
  it("renders exactly the three reaction buttons without a review field", () => {
    const markup = renderToStaticMarkup(
      createElement(ReactionSelector, {
        restaurantId: "restaurant-balanced-bowl",
      }),
    );

    expect(markup.match(/class="reaction-choice /g)).toHaveLength(3);
    expect(markup).toContain("좋아요");
    expect(markup).toContain("그냥 그래요");
    expect(markup).toContain("싫어요");
    expect(markup).toContain("개인 취향에 먼저 저장돼요");
    expect(markup).toContain("위치 기반 방문 확인");
    expect(markup).toContain("로그인 후 체크인");
    expect(markup).toContain("원본 좌표와 브라우저 위치 응답은 저장하지 않습니다");
    expect(markup).toContain("실제 식사를 보장하지 않습니다");
    expect(markup).not.toContain("textarea");
    expect(markup).not.toContain("별점");
  });

  it("stores one current reaction per restaurant and ignores corrupt data", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    values.set(PRIVATE_REACTION_STORAGE_KEY, "not-json");
    expect(readPrivateReaction(storage, "restaurant-balanced-bowl")).toBeNull();

    savePrivateReaction(storage, "restaurant-balanced-bowl", "like");
    savePrivateReaction(storage, "restaurant-balanced-bowl", "okay");

    expect(readPrivateReaction(storage, "restaurant-balanced-bowl")).toBe("okay");
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(values.get(PRIVATE_REACTION_STORAGE_KEY) ?? "{}"))
      .toEqual({ "restaurant-balanced-bowl": "okay" });
  });

  it("does not hide a browser storage write failure from the UI boundary", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("storage disabled");
      }),
    };

    expect(() =>
      savePrivateReaction(storage, "restaurant-balanced-bowl", "dislike"),
    ).toThrow("storage disabled");
  });
});

describe("detail safety copy", () => {
  it("shows exclusion as an explicit rule instead of a zero match", () => {
    const detail = getFixtureRestaurantDetail("restaurant-shellfish-table");
    if (!detail) throw new Error("shellfish fixture is required");

    const markup = renderToStaticMarkup(
      createElement(DetailMatchPanel, { match: detail.personalMatch }),
    );

    expect(markup).toContain("매칭 후보에서 제외");
    expect(markup).toContain("갑각류·조개류");
    expect(markup).not.toContain("0%");
  });

  it("uses a clear empty state when no creator evidence is publishable", () => {
    const markup = renderToStaticMarkup(
      createElement(CreatorEvidenceList, {
        restaurantName: "초록 테이블 성수",
        sources: [],
      }),
    );

    expect(markup).toContain("검증한 영상이 아직 없어요");
    expect(markup).toContain("0개");
  });
});
