import { describe, expect, it } from "vitest";

import {
  DEFAULT_ALGORITHM_CONFIG,
  validateAlgorithmConfig,
} from "../src/domain/algorithm-config";
import {
  BALANCED_BOWL_PERSONALIZED_REVIEWS,
  DOMAIN_FIXTURE,
} from "../src/domain/fixtures";
import {
  calculateCommunityWeight,
  calculatePersonalizedTrustPercent,
  calculateRestaurantMatch,
  calculateRestaurantScore,
  calculateReviewComposite,
} from "../src/domain/scoring";

const balancedBowlReviews = DOMAIN_FIXTURE.publicReviews.slice(0, 2);

function buildBalancedBowlScore() {
  return calculateRestaurantScore(
    DOMAIN_FIXTURE.analysisRun.id,
    DOMAIN_FIXTURE.restaurants[0].id,
    DOMAIN_FIXTURE.restaurants[0].name,
    balancedBowlReviews,
  );
}

describe("algorithm configuration", () => {
  it("keeps all rating and matching weight groups normalized", () => {
    expect(validateAlgorithmConfig(DEFAULT_ALGORITHM_CONFIG)).toEqual([]);
    expect(DEFAULT_ALGORITHM_CONFIG.reviewTrust.penalties.REVIEWER_ONE_SIDED).toBe(0);
  });
});

describe("multi-dimensional public score", () => {
  it("uses taste 60%, cleanliness 20%, and service 20%", () => {
    expect(calculateReviewComposite({ taste: 5, cleanliness: 4, service: 3 })).toBe(4.4);
  });

  it("rejects ratings outside the configured half-point step", () => {
    expect(() =>
      calculateReviewComposite({ taste: 4.2, cleanliness: 4, service: 4 }),
    ).toThrow(RangeError);
  });

  it("smooths community feedback and respects both bounds", () => {
    expect(calculateCommunityWeight(0, 0)).toBe(1);
    expect(calculateCommunityWeight(10, 0)).toBe(1.25);
    expect(calculateCommunityWeight(0, 10)).toBe(0.75);
    expect(calculateCommunityWeight(1_000, 0)).toBe(1.25);
    expect(calculateCommunityWeight(0, 1_000)).toBe(0.75);
    expect(() => calculateCommunityWeight(-1, 0)).toThrow(RangeError);
  });

  it("calculates dimension, public, trust, and overall scores from feedback only", () => {
    expect(buildBalancedBowlScore()).toEqual({
      analysisRunId: "run-baseline-v2",
      restaurantId: "restaurant-balanced-bowl",
      restaurantName: "밸런스 보울 성수",
      dimensionScores: {
        taste: 4.25,
        cleanliness: 4.38,
        service: 3.75,
      },
      publicRating: 4.18,
      reviewTrustPercent: 87.5,
      overallScore: 3.65,
      reviewCount: 2,
      isForming: true,
    });
  });

  it("does not change the public score when reviewer identities change", () => {
    const changedReviewerKeys = balancedBowlReviews.map((input, index) => ({
      ...input,
      review: { ...input.review, reviewerKey: `unrelated-reviewer-${index}` },
    }));

    const original = buildBalancedBowlScore();
    const changed = calculateRestaurantScore(
      DOMAIN_FIXTURE.analysisRun.id,
      DOMAIN_FIXTURE.restaurants[0].id,
      DOMAIN_FIXTURE.restaurants[0].name,
      changedReviewerKeys,
    );

    expect(changed).toEqual(original);
  });
});

describe("personalized matching", () => {
  it("uses reviewer similarity only in personalized trust", () => {
    expect(buildBalancedBowlScore().reviewTrustPercent).toBe(87.5);
    expect(calculatePersonalizedTrustPercent(BALANCED_BOWL_PERSONALIZED_REVIEWS)).toBe(83.33);
  });

  it("hard-excludes food the user does not eat", () => {
    const result = calculateRestaurantMatch({
      profile: DOMAIN_FIXTURE.userProfile,
      restaurant: DOMAIN_FIXTURE.restaurantProfiles[1],
      publicScore: {
        ...buildBalancedBowlScore(),
        restaurantId: DOMAIN_FIXTURE.restaurants[1].id,
      },
    });

    expect(result.status).toBe("excluded");
    expect(result.personalRankScore).toBeNull();
    expect(result.excludedFoodTags).toEqual(["shellfish"]);
  });

  it("renormalizes to content fit for cold-start users", () => {
    const result = calculateRestaurantMatch({
      profile: DOMAIN_FIXTURE.userProfile,
      restaurant: DOMAIN_FIXTURE.restaurantProfiles[0],
      publicScore: buildBalancedBowlScore(),
      reviewerEvidence: { fitPercent: 5, overlapCount: 4 },
    });

    expect(result.status).toBe("matched");
    expect(result.matchPercent).toBe(92.5);
    expect(result.components.reviewerFitPercent).toBeNull();
    expect(result.components.visitFitPercent).toBeNull();
    expect(result.reasons).toContain("COLD_START_CONTENT_ONLY");
  });

  it("uses reviewer and visit evidence only when enough evidence exists", () => {
    const score = buildBalancedBowlScore();
    const result = calculateRestaurantMatch({
      profile: DOMAIN_FIXTURE.userProfile,
      restaurant: DOMAIN_FIXTURE.restaurantProfiles[0],
      publicScore: score,
      personalizedReviews: BALANCED_BOWL_PERSONALIZED_REVIEWS,
      reviewerEvidence: { fitPercent: 100, overlapCount: 5 },
      visitEvidence: { fitPercent: 50, sampleSize: 2 },
    });

    expect(result.matchPercent).toBe(86.25);
    expect(result.personalizedTrustPercent).toBe(83.33);
    expect(result.personalRankScore).toBe(79.62);
    expect(result.reasons).toEqual([
      "DIRECT_PREFERENCE",
      "SIMILAR_REVIEWERS",
      "VISIT_HISTORY",
    ]);
  });

  it("does not invent a match score before any preference input", () => {
    const result = calculateRestaurantMatch({
      profile: { ...DOMAIN_FIXTURE.userProfile, axisPreferences: {} },
      restaurant: DOMAIN_FIXTURE.restaurantProfiles[0],
      publicScore: buildBalancedBowlScore(),
    });

    expect(result.status).toBe("needs_preferences");
    expect(result.matchPercent).toBeNull();
  });
});
