export type ISODateTime = string;

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

export type ReactionKind = "like" | "okay" | "dislike";
export type ReactionModerationStatus =
  | "pending"
  | "counted"
  | "held"
  | "rejected"
  | "private_only";

export type VisitProofMethod =
  | "none"
  | "location_checkin"
  | "merchant_qr"
  | "receipt"
  | "partner_transaction";

export type VisitProofStatus = "verified" | "expired" | "revoked" | "rejected";

export interface VisitProof {
  id: string;
  userId: string;
  restaurantId: string;
  method: Exclude<VisitProofMethod, "none">;
  status: VisitProofStatus;
  evidenceDigest: string;
  verifiedAt: ISODateTime;
  expiresAt: ISODateTime;
  usedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export type ReactionRiskCode =
  | "RATE_LIMITED"
  | "VISIT_PROOF_MISMATCH"
  | "DUPLICATE_PROOF"
  | "IMPOSSIBLE_TRAVEL"
  | "REACTION_BURST"
  | "ACCOUNT_CLUSTER";

export interface RestaurantReaction {
  id: string;
  userId: string;
  restaurantId: string;
  visitProofId: string | null;
  kind: ReactionKind;
  moderationStatus: ReactionModerationStatus;
  riskCodes: readonly ReactionRiskCode[];
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ReactionCounts {
  like: number;
  okay: number;
  dislike: number;
}

export interface RestaurantReactionSummary {
  restaurantId: string;
  counts: ReactionCounts;
  percentages: ReactionCounts | null;
  countedTotal: number;
  isForming: boolean;
  version: string;
}

export interface ReactionModerationDecision {
  status: Exclude<ReactionModerationStatus, "pending">;
  reasonCodes: readonly (
    | ReactionRiskCode
    | "AUTH_REQUIRED"
    | "PRIVATE_PREFERENCE_ONLY"
  )[];
}

export type CreatorVisitStatus = "candidate" | "confirmed" | "rejected" | "stale";

export interface CreatorChannel {
  id: string;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  subscriberCountFetchedAt: ISODateTime | null;
  uploadsPlaylistId: string;
  isAllowlisted: boolean;
  isActive: boolean;
  metadataFetchedAt: ISODateTime;
}

export interface CreatorVideo {
  id: string;
  youtubeVideoId: string;
  creatorChannelId: string;
  title: string;
  descriptionExcerpt: string | null;
  thumbnailUrl: string | null;
  publishedAt: ISODateTime;
  privacyStatus: "public" | "unlisted" | "private" | null;
  metadataFetchedAt: ISODateTime;
  isActive: boolean;
}

export interface CreatorVisitEvidence {
  id: string;
  creatorVideoId: string;
  restaurantId: string;
  status: CreatorVisitStatus;
  evidenceTimestampSeconds: number | null;
  matchNotes: string | null;
  confirmedBy: string | null;
  confirmedAt: ISODateTime | null;
  lastVerifiedAt: ISODateTime | null;
}

export interface CreatorEvidenceItem {
  channel: CreatorChannel;
  video: CreatorVideo;
  evidence: CreatorVisitEvidence;
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
  onboardingSources: readonly (
    | "balance_game"
    | "direct_input"
    | "reaction_history"
  )[];
  updatedAt: ISODateTime;
}

export interface RestaurantPreferenceProfile {
  restaurantId: string;
  axisProfile: Record<PreferenceAxis, number>;
  foodTags: readonly string[];
}

export interface SimilarUserEvidence {
  fitPercent: number;
  overlapCount: number;
}

export interface VisitHistoryEvidence {
  fitPercent: number;
  sampleSize: number;
}

export type MatchReasonCode =
  | "EXCLUDED_FOOD"
  | "DIRECT_PREFERENCE"
  | "SIMILAR_USERS"
  | "VISIT_HISTORY"
  | "COLD_START_CONTENT_ONLY";

export type MatchStatus = "matched" | "excluded" | "needs_preferences";

export interface RestaurantMatchResult {
  restaurantId: string;
  status: MatchStatus;
  matchPercent: number | null;
  components: {
    contentFitPercent: number | null;
    similarUserFitPercent: number | null;
    visitFitPercent: number | null;
  };
  reasons: readonly MatchReasonCode[];
  excludedFoodTags: readonly string[];
}

export interface AlgorithmConfig {
  version: string;
  reactions: {
    minimumCountForEstablishedDistribution: number;
    allowedKinds: readonly ReactionKind[];
  };
  visitProof: {
    publicMethods: readonly Exclude<VisitProofMethod, "none">[];
    locationMaximumDistanceMeters: number;
    locationMaximumAccuracyMeters: number;
    tokenValidityHours: number;
  };
  abusePrevention: {
    temporaryNetworkHashRetentionDays: number;
    holdRiskCodes: readonly ReactionRiskCode[];
    rejectRiskCodes: readonly ReactionRiskCode[];
  };
  matching: {
    minimumSimilarUserOverlap: number;
    componentWeights: {
      content: number;
      similarUsers: number;
      visit: number;
    };
  };
  creatorEvidence: {
    metadataMaximumAgeDays: number;
    source: "youtube_data_api";
    allowDerivedAuthorityScore: false;
  };
  display: {
    percentageDecimals: number;
    matchDecimals: number;
  };
}
