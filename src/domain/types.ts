export type ISODateTime = string;

export type RatingDimension = "taste" | "cleanliness" | "service";

export interface RatingBreakdown {
  taste: number;
  cleanliness: number;
  service: number;
}

export interface Restaurant {
  id: string;
  kakaoPlaceId: string;
  name: string;
  categoryGroupCode: string | null;
  categoryName: string;
  roadAddress: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  region: string;
  createdAt: ISODateTime;
}

export type ReviewSource = "seed" | "admin_form" | "csv";

export interface Review {
  id: string;
  externalId: string;
  restaurantId: string;
  reviewerKey: string;
  ratings: RatingBreakdown;
  reviewText: string;
  reviewedAt: ISODateTime;
  source: ReviewSource;
  isActive: boolean;
  createdBy: string | null;
  createdAt: ISODateTime;
}

export interface ReviewFeedbackSummary {
  reviewId: string;
  helpfulCount: number;
  unhelpfulCount: number;
  source: "seed" | "live_aggregate";
  updatedAt: ISODateTime;
}

export type AnalysisTrigger = "seed" | "manual" | "cron";
export type AnalysisRunStatus = "running" | "succeeded" | "failed";

export interface AnalysisRun {
  id: string;
  triggerType: AnalysisTrigger;
  status: AnalysisRunStatus;
  algorithmVersion: string;
  modelId: string | null;
  totalReviews: number;
  aiCandidateCount: number;
  aiSuccessCount: number;
  errorSummary: string | null;
  startedAt: ISODateTime;
  finishedAt: ISODateTime | null;
  createdBy: string | null;
}

export type RuleSignalCode =
  | "RATING_BURST"
  | "TEXT_SIMILARITY"
  | "REVIEWER_ONE_SIDED"
  | "VAGUE_TEMPLATE";

export interface AiReviewResult {
  promotionalPatternStrength: number;
  naturalSpecificity: number;
  confidence: number;
  reasonCodes: readonly string[];
  shortExplanation: string;
}

export interface ReviewAnalysis {
  id: string;
  analysisRunId: string;
  reviewId: string;
  ruleSignals: readonly RuleSignalCode[];
  ruleScore: number;
  aiRequired: boolean;
  aiResult: AiReviewResult | null;
  aiAdjustment: number;
  finalTrust: number;
  explanation: {
    codes: readonly string[];
    shortExplanation: string;
  };
  createdAt: ISODateTime;
}

export interface PublicScoredReview {
  review: Review;
  feedback: ReviewFeedbackSummary;
  analysis: ReviewAnalysis;
}

export interface RestaurantScore {
  analysisRunId: string;
  restaurantId: string;
  restaurantName: string;
  dimensionScores: RatingBreakdown;
  publicRating: number;
  reviewTrustPercent: number;
  overallScore: number;
  reviewCount: number;
  isForming: boolean;
}

export type PreferenceAxis =
  | "spicy"
  | "sweet"
  | "light"
  | "rich"
  | "value"
  | "cleanliness"
  | "service";

export type PreferenceVector = Partial<Record<PreferenceAxis, number>>;

export interface UserPreferenceProfile {
  profileVersion: string;
  axisPreferences: PreferenceVector;
  excludedFoodTags: readonly string[];
  onboardingSources: readonly ("balance_game" | "direct_input" | "visit_satisfaction")[];
  updatedAt: ISODateTime;
}

export interface RestaurantPreferenceProfile {
  restaurantId: string;
  axisProfile: Record<PreferenceAxis, number>;
  foodTags: readonly string[];
}

export interface ReviewerSimilarityEvidence {
  fitPercent: number;
  overlapCount: number;
}

export interface VisitSatisfactionEvidence {
  fitPercent: number;
  sampleSize: number;
}

export interface PersonalizedScoredReview extends PublicScoredReview {
  reviewerSimilarityPercent: number | null;
}

export type MatchReasonCode =
  | "EXCLUDED_FOOD"
  | "DIRECT_PREFERENCE"
  | "SIMILAR_REVIEWERS"
  | "VISIT_HISTORY"
  | "COLD_START_CONTENT_ONLY";

export type MatchStatus = "matched" | "excluded" | "needs_preferences";

export interface RestaurantMatchResult {
  restaurantId: string;
  status: MatchStatus;
  matchPercent: number | null;
  personalizedTrustPercent: number | null;
  personalizedQualityPercent: number | null;
  personalRankScore: number | null;
  components: {
    contentFitPercent: number | null;
    reviewerFitPercent: number | null;
    visitFitPercent: number | null;
  };
  reasons: readonly MatchReasonCode[];
  excludedFoodTags: readonly string[];
}

export interface AlgorithmConfig {
  version: string;
  rating: {
    step: number;
    weights: Record<RatingDimension, number>;
  };
  communityFeedback: {
    priorStrength: number;
    balanceMultiplier: number;
    minimumWeight: number;
    maximumWeight: number;
  };
  publicScore: {
    minimumActiveReviews: number;
  };
  matching: {
    minimumReviewerOverlap: number;
    componentWeights: {
      content: number;
      reviewer: number;
      visit: number;
    };
    rankingWeights: {
      match: number;
      quality: number;
    };
    reviewerSimilarityWeight: {
      minimum: number;
      maximum: number;
    };
  };
  reviewTrust: {
    penalties: Record<RuleSignalCode, number>;
    aiCandidateMaximumRuleScore: number;
    representativeMinimumTrust: number;
  };
  display: {
    scoreDecimals: number;
    detailDecimals: number;
  };
}
