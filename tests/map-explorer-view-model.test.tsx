import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getReactionDataState,
  sortRestaurantsForMode,
  toggleCategorySelection,
} from "../src/components/map/map-view-model";
import { PersonalMatchSummary } from "../src/components/map/personal-match-summary";
import { ReactionDistribution } from "../src/components/map/reaction-distribution";
import { SelectedRestaurantSheet } from "../src/components/map/selected-restaurant-sheet";
import { getFixtureMapExplorerData } from "../src/components/map/map-explorer-fixture";
import { PublicDataUnavailable } from "../src/components/public-data/public-data-unavailable";
import { DOMAIN_FIXTURE } from "../src/domain/fixtures";
import {
  calculateRestaurantMatch,
  summarizeRestaurantReactions,
} from "../src/domain/signals";
import type { RestaurantReactionSummary } from "../src/domain/types";

describe("public reaction view model", () => {
  it("returns to the full category when the active category is selected again", () => {
    expect(toggleCategorySelection("한식", "한식")).toBe("전체");
    expect(toggleCategorySelection("전체", "한식")).toBe("한식");
    expect(toggleCategorySelection("한식", "전체")).toBe("전체");
  });

  it("distinguishes empty, forming, and established distributions", () => {
    const empty = summarizeRestaurantReactions("empty", []);
    const forming = summarizeRestaurantReactions(
      DOMAIN_FIXTURE.restaurants[0].id,
      DOMAIN_FIXTURE.reactions,
    );
    const established: RestaurantReactionSummary = {
      ...forming,
      countedTotal: 10,
      counts: { like: 6, okay: 3, dislike: 1 },
      percentages: { like: 60, okay: 30, dislike: 10 },
      isForming: false,
    };

    expect(getReactionDataState(empty)).toBe("empty");
    expect(getReactionDataState(forming)).toBe("forming");
    expect(getReactionDataState(established)).toBe("established");
  });

  it("renders all three counted-only reactions without inventing an empty percentage", () => {
    const summary = summarizeRestaurantReactions(
      DOMAIN_FIXTURE.restaurants[2].id,
      DOMAIN_FIXTURE.reactions,
    );
    const markup = renderToStaticMarkup(
      createElement(ReactionDistribution, { summary }),
    );

    expect(markup).toContain("좋아요");
    expect(markup).toContain("그냥 그래요");
    expect(markup).toContain("싫어요");
    expect(markup).toContain("아직 방문 확인 공개 반응이 없어요.");
    expect(markup).not.toContain("--reaction-width");
  });

  it("explains that fewer than ten reactions are still forming", () => {
    const summary = summarizeRestaurantReactions(
      DOMAIN_FIXTURE.restaurants[0].id,
      DOMAIN_FIXTURE.reactions,
    );
    const markup = renderToStaticMarkup(
      createElement(ReactionDistribution, { summary }),
    );

    expect(markup).toContain("10명이 모이기 전에는 참고용");
    expect(markup).toContain("좋아요");
    expect(markup).toContain("1명");
  });
});

describe("selected restaurant UI boundary", () => {
  it("renders real-data-shaped reactions, matching, and confirmed evidence without a score", () => {
    const data = getFixtureMapExplorerData();
    const restaurant = data.restaurants[0];
    const summary = data.reactionSummaries.find(
      (item) => item.restaurantId === restaurant.id,
    );
    const match = data.personalMatches.find(
      (item) => item.restaurantId === restaurant.id,
    );
    const creatorSources = data.creatorVisitSources.filter(
      (item) => item.restaurantId === restaurant.id,
    );

    const markup = renderToStaticMarkup(
      createElement(SelectedRestaurantSheet, {
        restaurant,
        summary,
        match,
        creatorSources,
        onClose: () => undefined,
      }),
    );

    expect(markup).toContain(restaurant.name);
    expect(markup).toContain("좋아요");
    expect(markup).toContain("그냥 그래요");
    expect(markup).toContain("싫어요");
    expect(markup).toContain("확인된 방문 영상");
    expect(markup).toContain(`/restaurants/${restaurant.id}`);
    expect(markup).not.toContain("별점");
    expect(markup).not.toContain("종합점수");
  });

  it("keeps the presentation snapshot flag on detail links", () => {
    const data = getFixtureMapExplorerData();
    const restaurant = data.restaurants[0];

    const markup = renderToStaticMarkup(
      createElement(SelectedRestaurantSheet, {
        restaurant,
        creatorSources: [],
        detailHrefSuffix: "?snapshot=1",
        onClose: () => undefined,
      }),
    );

    expect(markup).toContain(`/restaurants/${restaurant.id}?snapshot=1`);
  });
});

describe("presentation backup state", () => {
  it("offers an explicit snapshot mode without silently replacing public data", () => {
    const markup = renderToStaticMarkup(
      createElement(PublicDataUnavailable, {
        retryHref: "/",
        snapshotHref: "/?snapshot=1",
      }),
    );

    expect(markup).toContain("식당 데이터를 잠시 불러올 수 없습니다");
    expect(markup).toContain("발표 백업 모드로 보기");
    expect(markup).toContain("/?snapshot=1");
  });
});

describe("personal matching view model", () => {
  const matches = DOMAIN_FIXTURE.restaurantProfiles.map((restaurant) =>
    calculateRestaurantMatch({
      profile: DOMAIN_FIXTURE.userProfile,
      restaurant,
    }),
  );

  it("hard-excludes avoided food and orders the remaining restaurants by match", () => {
    const ordered = sortRestaurantsForMode(
      DOMAIN_FIXTURE.restaurants,
      "personal",
      matches,
    );

    expect(ordered.map((restaurant) => restaurant.id)).not.toContain(
      "restaurant-shellfish-table",
    );
    expect(ordered.map((restaurant) => restaurant.id)).toEqual([
      "restaurant-balanced-bowl",
      "restaurant-green-table",
    ]);
  });

  it("keeps public browsing order unchanged", () => {
    expect(
      sortRestaurantsForMode(DOMAIN_FIXTURE.restaurants, "public", matches),
    ).toEqual(DOMAIN_FIXTURE.restaurants);
  });

  it("labels cold-start matching as preference-only", () => {
    const match = matches.find(
      (item) => item.restaurantId === "restaurant-green-table",
    );
    if (!match) throw new Error("green table match fixture is required");

    const markup = renderToStaticMarkup(
      createElement(PersonalMatchSummary, { match }),
    );

    expect(markup).toContain("나와의 매칭");
    expect(markup).toContain("직접 입력한 맛 취향");
    expect(markup).toContain("직접 입력한 취향만 반영했어요");
    expect(markup).not.toContain("취향이 비슷한 사용자의 반응");
  });
});
