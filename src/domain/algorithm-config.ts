import type { AlgorithmConfig } from "./types";

export const DEFAULT_ALGORITHM_CONFIG = {
  version: "2026-08-25.2",
  rating: {
    step: 0.5,
    weights: {
      taste: 0.6,
      cleanliness: 0.2,
      service: 0.2,
    },
  },
  communityFeedback: {
    priorStrength: 10,
    balanceMultiplier: 0.5,
    minimumWeight: 0.75,
    maximumWeight: 1.25,
  },
  publicScore: {
    minimumActiveReviews: 10,
  },
  matching: {
    minimumReviewerOverlap: 5,
    componentWeights: {
      content: 0.5,
      reviewer: 0.3,
      visit: 0.2,
    },
    rankingWeights: {
      match: 0.6,
      quality: 0.4,
    },
    reviewerSimilarityWeight: {
      minimum: 0.5,
      maximum: 1.5,
    },
  },
  reviewTrust: {
    penalties: {
      RATING_BURST: 15,
      TEXT_SIMILARITY: 25,
      REVIEWER_ONE_SIDED: 0,
      VAGUE_TEMPLATE: 10,
    },
    aiCandidateMaximumRuleScore: 70,
    representativeMinimumTrust: 60,
  },
  display: {
    scoreDecimals: 1,
    detailDecimals: 2,
  },
} as const satisfies AlgorithmConfig;

function approximatelyOne(value: number) {
  return Math.abs(value - 1) < Number.EPSILON * 10;
}

export function validateAlgorithmConfig(config: AlgorithmConfig): readonly string[] {
  const errors: string[] = [];
  const ratingWeightTotal = Object.values(config.rating.weights).reduce(
    (total, weight) => total + weight,
    0,
  );
  const matchComponentTotal = Object.values(config.matching.componentWeights).reduce(
    (total, weight) => total + weight,
    0,
  );
  const rankingWeightTotal = Object.values(config.matching.rankingWeights).reduce(
    (total, weight) => total + weight,
    0,
  );

  if (!config.version.trim()) errors.push("version is required");
  if (!approximatelyOne(ratingWeightTotal)) errors.push("rating weights must sum to 1");
  if (!approximatelyOne(matchComponentTotal)) {
    errors.push("matching component weights must sum to 1");
  }
  if (!approximatelyOne(rankingWeightTotal)) errors.push("ranking weights must sum to 1");
  if (config.rating.step <= 0 || config.rating.step > 5) {
    errors.push("rating step must be greater than 0 and at most 5");
  }
  if (config.communityFeedback.minimumWeight > config.communityFeedback.maximumWeight) {
    errors.push("community feedback weight bounds are reversed");
  }
  if (config.matching.minimumReviewerOverlap < 1) {
    errors.push("minimum reviewer overlap must be positive");
  }
  if (config.reviewTrust.penalties.REVIEWER_ONE_SIDED !== 0) {
    errors.push("reviewer behavior cannot penalize public trust");
  }

  return errors;
}
