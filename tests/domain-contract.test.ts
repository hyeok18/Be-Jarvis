import { describe, expect, it } from "vitest";

import {
  DEFAULT_ALGORITHM_CONFIG,
  validateAlgorithmConfig,
} from "../src/domain/algorithm-config";
import {
  CREATOR_EVIDENCE_FIXTURE,
  DOMAIN_FIXTURE,
} from "../src/domain/fixtures";
import {
  calculateRestaurantMatch,
  decideReactionModeration,
  isCreatorMetadataFresh,
  selectPublishableCreatorEvidence,
  summarizeRestaurantReactions,
} from "../src/domain/signals";

describe("algorithm configuration", () => {
  it("allows exactly three reactions and prohibits derived creator authority scores", () => {
    expect(validateAlgorithmConfig(DEFAULT_ALGORITHM_CONFIG)).toEqual([]);
    expect(DEFAULT_ALGORITHM_CONFIG.reactions.allowedKinds).toEqual([
      "like",
      "okay",
      "dislike",
    ]);
    expect(DEFAULT_ALGORITHM_CONFIG.creatorEvidence.allowDerivedAuthorityScore).toBe(
      false,
    );
  });

  it("keeps the matching components normalized", () => {
    expect(
      Object.values(DEFAULT_ALGORITHM_CONFIG.matching.componentWeights).reduce(
        (total, value) => total + value,
        0,
      ),
    ).toBe(1);
  });
});

describe("public reaction distribution", () => {
  it("counts only active reactions with counted moderation status", () => {
    expect(
      summarizeRestaurantReactions(
        DOMAIN_FIXTURE.restaurants[0].id,
        DOMAIN_FIXTURE.reactions,
      ),
    ).toEqual({
      restaurantId: "restaurant-balanced-bowl",
      counts: { like: 1, okay: 1, dislike: 1 },
      percentages: { like: 33.33, okay: 33.33, dislike: 33.33 },
      countedTotal: 3,
      isForming: true,
      version: "2026-08-25.3",
    });
  });

  it("uses a null distribution instead of inventing zero percentages", () => {
    expect(summarizeRestaurantReactions("restaurant-without-reactions", [])).toEqual({
      restaurantId: "restaurant-without-reactions",
      counts: { like: 0, okay: 0, dislike: 0 },
      percentages: null,
      countedTotal: 0,
      isForming: true,
      version: "2026-08-25.3",
    });
  });
});

describe("visit proof and reaction moderation", () => {
  it("keeps unverified reactions private without requiring a receipt", () => {
    expect(
      decideReactionModeration({
        authenticated: true,
        visitProofMethod: "none",
        visitProofMatchesRestaurant: false,
      }),
    ).toEqual({
      status: "private_only",
      reasonCodes: ["PRIVATE_PREFERENCE_ONLY"],
    });
  });

  it("counts a matching location check-in when no abuse signal exists", () => {
    expect(
      decideReactionModeration({
        authenticated: true,
        visitProofMethod: "location_checkin",
        visitProofMatchesRestaurant: true,
      }),
    ).toEqual({ status: "counted", reasonCodes: [] });
  });

  it("holds suspicious traffic and rejects proof mismatches", () => {
    expect(
      decideReactionModeration({
        authenticated: true,
        visitProofMethod: "location_checkin",
        visitProofMatchesRestaurant: true,
        riskCodes: ["REACTION_BURST"],
      }),
    ).toEqual({ status: "held", reasonCodes: ["REACTION_BURST"] });

    expect(
      decideReactionModeration({
        authenticated: true,
        visitProofMethod: "location_checkin",
        visitProofMatchesRestaurant: false,
      }),
    ).toEqual({
      status: "rejected",
      reasonCodes: ["VISIT_PROOF_MISMATCH"],
    });
  });

  it("rejects unauthenticated public reactions", () => {
    expect(
      decideReactionModeration({
        authenticated: false,
        visitProofMethod: "location_checkin",
        visitProofMatchesRestaurant: true,
      }),
    ).toEqual({ status: "rejected", reasonCodes: ["AUTH_REQUIRED"] });
  });
});

describe("creator evidence", () => {
  it("treats metadata as fresh through the configured 30-day boundary", () => {
    expect(
      isCreatorMetadataFresh(
        "2026-07-26T12:00:00.000Z",
        DOMAIN_FIXTURE.now,
      ),
    ).toBe(true);
    expect(
      isCreatorMetadataFresh(
        "2026-07-26T11:59:59.999Z",
        DOMAIN_FIXTURE.now,
      ),
    ).toBe(false);
  });

  it("publishes only confirmed fresh evidence and sorts raw subscriber counts", () => {
    const result = selectPublishableCreatorEvidence(
      CREATOR_EVIDENCE_FIXTURE,
      DOMAIN_FIXTURE.now,
    );

    expect(result.map(({ channel }) => channel.id)).toEqual([
      "creator-large",
      "creator-small",
      "creator-hidden",
    ]);
    expect(result.map(({ channel }) => channel.subscriberCount)).toEqual([
      2_300_000,
      120_000,
      null,
    ]);
    expect(result.some(({ evidence }) => evidence.status === "candidate")).toBe(false);
    expect(result.some(({ channel }) => channel.id === "creator-stale")).toBe(false);
  });
});

describe("personalized matching", () => {
  it("hard-excludes food the user does not eat", () => {
    const result = calculateRestaurantMatch({
      profile: DOMAIN_FIXTURE.userProfile,
      restaurant: DOMAIN_FIXTURE.restaurantProfiles[1],
    });

    expect(result.status).toBe("excluded");
    expect(result.matchPercent).toBe(0);
    expect(result.excludedFoodTags).toEqual(["shellfish"]);
  });

  it("renormalizes to content fit for cold-start users", () => {
    const result = calculateRestaurantMatch({
      profile: DOMAIN_FIXTURE.userProfile,
      restaurant: DOMAIN_FIXTURE.restaurantProfiles[0],
      similarUserEvidence: { fitPercent: 5, overlapCount: 4 },
    });

    expect(result.status).toBe("matched");
    expect(result.matchPercent).toBe(92.5);
    expect(result.components.similarUserFitPercent).toBeNull();
    expect(result.reasons).toContain("COLD_START_CONTENT_ONLY");
  });

  it("uses similar users and visit history only when evidence is sufficient", () => {
    const result = calculateRestaurantMatch({
      profile: DOMAIN_FIXTURE.userProfile,
      restaurant: DOMAIN_FIXTURE.restaurantProfiles[0],
      similarUserEvidence: { fitPercent: 100, overlapCount: 5 },
      visitEvidence: { fitPercent: 50, sampleSize: 2 },
    });

    expect(result.matchPercent).toBe(86.25);
    expect(result.reasons).toEqual([
      "DIRECT_PREFERENCE",
      "SIMILAR_USERS",
      "VISIT_HISTORY",
    ]);
  });

  it("does not invent a match before preference input", () => {
    const result = calculateRestaurantMatch({
      profile: { ...DOMAIN_FIXTURE.userProfile, axisPreferences: {} },
      restaurant: DOMAIN_FIXTURE.restaurantProfiles[0],
    });

    expect(result.status).toBe("needs_preferences");
    expect(result.matchPercent).toBeNull();
  });
});
