import { DEFAULT_ALGORITHM_CONFIG } from "./algorithm-config";
import type {
  AlgorithmConfig,
  PersonalizedScoredReview,
  PublicScoredReview,
  RatingBreakdown,
  RestaurantMatchResult,
  RestaurantPreferenceProfile,
  RestaurantScore,
  ReviewerSimilarityEvidence,
  UserPreferenceProfile,
  VisitSatisfactionEvidence,
} from "./types";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function assertPercent(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${label} must be between 0 and 100`);
  }
}

function assertRating(value: number, step: number, label: string) {
  const stepUnits = value / step;
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 5 ||
    Math.abs(stepUnits - Math.round(stepUnits)) > Number.EPSILON * 10
  ) {
    throw new RangeError(`${label} must be between 0 and 5 in ${step}-point steps`);
  }
}

export function calculateReviewComposite(
  ratings: RatingBreakdown,
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
) {
  assertRating(ratings.taste, config.rating.step, "taste rating");
  assertRating(ratings.cleanliness, config.rating.step, "cleanliness rating");
  assertRating(ratings.service, config.rating.step, "service rating");

  return roundTo(
    ratings.taste * config.rating.weights.taste +
      ratings.cleanliness * config.rating.weights.cleanliness +
      ratings.service * config.rating.weights.service,
    config.display.detailDecimals,
  );
}

export function calculateCommunityWeight(
  helpfulCount: number,
  unhelpfulCount: number,
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
) {
  if (
    !Number.isInteger(helpfulCount) ||
    !Number.isInteger(unhelpfulCount) ||
    helpfulCount < 0 ||
    unhelpfulCount < 0
  ) {
    throw new RangeError("feedback counts must be non-negative integers");
  }

  const balance =
    (helpfulCount - unhelpfulCount) /
    (helpfulCount + unhelpfulCount + config.communityFeedback.priorStrength);
  const weight = 1 + config.communityFeedback.balanceMultiplier * balance;

  return clamp(
    weight,
    config.communityFeedback.minimumWeight,
    config.communityFeedback.maximumWeight,
  );
}

function weightedAverage(values: readonly { value: number; weight: number }[]) {
  const totalWeight = values.reduce((total, item) => total + item.weight, 0);
  if (totalWeight <= 0) throw new RangeError("at least one positive weight is required");
  return values.reduce((total, item) => total + item.value * item.weight, 0) / totalWeight;
}

export function calculateRestaurantScore(
  analysisRunId: string,
  restaurantId: string,
  restaurantName: string,
  inputs: readonly PublicScoredReview[],
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
): RestaurantScore {
  const active = inputs.filter(
    ({ review }) => review.isActive && review.restaurantId === restaurantId,
  );
  if (active.length === 0) throw new RangeError("at least one active review is required");

  const rows = active.map(({ review, feedback, analysis }) => {
    if (feedback.reviewId !== review.id || analysis.reviewId !== review.id) {
      throw new RangeError("review, feedback, and analysis identifiers must match");
    }
    assertPercent(analysis.finalTrust, "final trust");
    return {
      ratings: review.ratings,
      composite: calculateReviewComposite(review.ratings, config),
      trust: analysis.finalTrust,
      weight: calculateCommunityWeight(
        feedback.helpfulCount,
        feedback.unhelpfulCount,
        config,
      ),
    };
  });

  const average = (select: (row: (typeof rows)[number]) => number) =>
    weightedAverage(rows.map((row) => ({ value: select(row), weight: row.weight })));
  const publicRating = average((row) => row.composite);
  const reviewTrustPercent = average((row) => row.trust);

  return {
    analysisRunId,
    restaurantId,
    restaurantName,
    dimensionScores: {
      taste: roundTo(average((row) => row.ratings.taste), config.display.detailDecimals),
      cleanliness: roundTo(
        average((row) => row.ratings.cleanliness),
        config.display.detailDecimals,
      ),
      service: roundTo(average((row) => row.ratings.service), config.display.detailDecimals),
    },
    publicRating: roundTo(publicRating, config.display.detailDecimals),
    reviewTrustPercent: roundTo(reviewTrustPercent, config.display.detailDecimals),
    overallScore: roundTo(
      publicRating * (reviewTrustPercent / 100),
      config.display.detailDecimals,
    ),
    reviewCount: active.length,
    isForming: active.length < config.publicScore.minimumActiveReviews,
  };
}

export function compareRestaurantScores(left: RestaurantScore, right: RestaurantScore) {
  return (
    right.overallScore - left.overallScore ||
    right.reviewTrustPercent - left.reviewTrustPercent ||
    right.reviewCount - left.reviewCount ||
    left.restaurantName.localeCompare(right.restaurantName, "ko")
  );
}

function reviewerSimilarityWeight(
  similarityPercent: number | null,
  config: AlgorithmConfig,
) {
  if (similarityPercent === null) return 1;
  assertPercent(similarityPercent, "reviewer similarity");
  const { minimum, maximum } = config.matching.reviewerSimilarityWeight;
  return minimum + (similarityPercent / 100) * (maximum - minimum);
}

export function calculatePersonalizedTrustPercent(
  reviews: readonly PersonalizedScoredReview[],
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
) {
  const activeReviews = reviews.filter(({ review }) => review.isActive);
  if (activeReviews.length === 0) throw new RangeError("at least one active review is required");

  const values = activeReviews.map(
    ({ review, feedback, analysis, reviewerSimilarityPercent }) => {
    if (feedback.reviewId !== review.id || analysis.reviewId !== review.id) {
      throw new RangeError("review, feedback, and analysis identifiers must match");
    }
    assertPercent(analysis.finalTrust, "final trust");
      return {
        value: analysis.finalTrust,
        weight:
          calculateCommunityWeight(feedback.helpfulCount, feedback.unhelpfulCount, config) *
          reviewerSimilarityWeight(reviewerSimilarityPercent, config),
      };
    },
  );

  return roundTo(weightedAverage(values), config.display.detailDecimals);
}

function calculateContentFit(
  profile: UserPreferenceProfile,
  restaurant: RestaurantPreferenceProfile,
) {
  const entries = Object.entries(profile.axisPreferences) as Array<
    [keyof RestaurantPreferenceProfile["axisProfile"], number]
  >;
  if (entries.length === 0) return null;

  const totalDifference = entries.reduce((total, [axis, preference]) => {
    assertPercent(preference, `${axis} preference`);
    const restaurantValue = restaurant.axisProfile[axis];
    assertPercent(restaurantValue, `${axis} restaurant profile`);
    return total + Math.abs(preference - restaurantValue);
  }, 0);

  return 100 - totalDifference / entries.length;
}

export function calculateRestaurantMatch(input: {
  profile: UserPreferenceProfile;
  restaurant: RestaurantPreferenceProfile;
  publicScore: RestaurantScore;
  personalizedReviews?: readonly PersonalizedScoredReview[];
  reviewerEvidence?: ReviewerSimilarityEvidence;
  visitEvidence?: VisitSatisfactionEvidence;
  config?: AlgorithmConfig;
}): RestaurantMatchResult {
  const config = input.config ?? DEFAULT_ALGORITHM_CONFIG;
  if (
    input.restaurant.restaurantId !== input.publicScore.restaurantId ||
    input.profile.profileVersion.trim().length === 0
  ) {
    throw new RangeError("matching inputs must reference one restaurant and a profile version");
  }
  const excludedTags = input.restaurant.foodTags.filter((tag) =>
    input.profile.excludedFoodTags.includes(tag),
  );

  if (excludedTags.length > 0) {
    return {
      restaurantId: input.restaurant.restaurantId,
      status: "excluded",
      matchPercent: 0,
      personalizedTrustPercent: null,
      personalizedQualityPercent: null,
      personalRankScore: null,
      components: {
        contentFitPercent: null,
        reviewerFitPercent: null,
        visitFitPercent: null,
      },
      reasons: ["EXCLUDED_FOOD"],
      excludedFoodTags: excludedTags,
    };
  }

  const contentFit = calculateContentFit(input.profile, input.restaurant);
  if (contentFit === null) {
    return {
      restaurantId: input.restaurant.restaurantId,
      status: "needs_preferences",
      matchPercent: null,
      personalizedTrustPercent: null,
      personalizedQualityPercent: null,
      personalRankScore: null,
      components: {
        contentFitPercent: null,
        reviewerFitPercent: null,
        visitFitPercent: null,
      },
      reasons: [],
      excludedFoodTags: [],
    };
  }

  const reviewerFit =
    input.reviewerEvidence &&
    input.reviewerEvidence.overlapCount >= config.matching.minimumReviewerOverlap
      ? input.reviewerEvidence.fitPercent
      : null;
  const visitFit =
    input.visitEvidence && input.visitEvidence.sampleSize > 0
      ? input.visitEvidence.fitPercent
      : null;
  if (reviewerFit !== null) assertPercent(reviewerFit, "reviewer fit");
  if (visitFit !== null) assertPercent(visitFit, "visit fit");

  const availableComponents = [
    { value: contentFit, weight: config.matching.componentWeights.content },
    ...(reviewerFit === null
      ? []
      : [{ value: reviewerFit, weight: config.matching.componentWeights.reviewer }]),
    ...(visitFit === null
      ? []
      : [{ value: visitFit, weight: config.matching.componentWeights.visit }]),
  ];
  const matchPercent = weightedAverage(availableComponents);
  const personalizedTrustPercent = input.personalizedReviews
    ? calculatePersonalizedTrustPercent(input.personalizedReviews, config)
    : input.publicScore.reviewTrustPercent;
  const personalizedQualityPercent =
    (input.publicScore.publicRating / 5) * 100 * (personalizedTrustPercent / 100);
  const personalRankScore =
    matchPercent * config.matching.rankingWeights.match +
    personalizedQualityPercent * config.matching.rankingWeights.quality;
  const reasons: RestaurantMatchResult["reasons"] = [
    "DIRECT_PREFERENCE",
    ...(reviewerFit === null ? [] : (["SIMILAR_REVIEWERS"] as const)),
    ...(visitFit === null ? [] : (["VISIT_HISTORY"] as const)),
    ...(reviewerFit === null && visitFit === null
      ? (["COLD_START_CONTENT_ONLY"] as const)
      : []),
  ];

  return {
    restaurantId: input.restaurant.restaurantId,
    status: "matched",
    matchPercent: roundTo(matchPercent, config.display.detailDecimals),
    personalizedTrustPercent,
    personalizedQualityPercent: roundTo(
      personalizedQualityPercent,
      config.display.detailDecimals,
    ),
    personalRankScore: roundTo(personalRankScore, config.display.detailDecimals),
    components: {
      contentFitPercent: roundTo(contentFit, config.display.detailDecimals),
      reviewerFitPercent: reviewerFit,
      visitFitPercent: visitFit,
    },
    reasons,
    excludedFoodTags: [],
  };
}
