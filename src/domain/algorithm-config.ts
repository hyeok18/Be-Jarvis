import type { AlgorithmConfig, ReactionKind } from "./types";

export const DEFAULT_ALGORITHM_CONFIG = {
  version: "2026-08-25.3",
  reactions: {
    minimumCountForEstablishedDistribution: 10,
    allowedKinds: ["like", "okay", "dislike"],
  },
  visitProof: {
    publicMethods: [
      "location_checkin",
      "merchant_qr",
      "receipt",
      "partner_transaction",
    ],
    locationMaximumDistanceMeters: 120,
    locationMaximumAccuracyMeters: 100,
    tokenValidityHours: 24,
  },
  abusePrevention: {
    temporaryNetworkHashRetentionDays: 7,
    holdRiskCodes: [
      "RATE_LIMITED",
      "IMPOSSIBLE_TRAVEL",
      "REACTION_BURST",
      "ACCOUNT_CLUSTER",
    ],
    rejectRiskCodes: ["VISIT_PROOF_MISMATCH", "DUPLICATE_PROOF"],
  },
  matching: {
    minimumSimilarUserOverlap: 5,
    componentWeights: {
      content: 0.5,
      similarUsers: 0.3,
      visit: 0.2,
    },
  },
  creatorEvidence: {
    metadataMaximumAgeDays: 30,
    source: "youtube_data_api",
    allowDerivedAuthorityScore: false,
  },
  display: {
    percentageDecimals: 2,
    matchDecimals: 2,
  },
} as const satisfies AlgorithmConfig;

function approximatelyOne(value: number) {
  return Math.abs(value - 1) < Number.EPSILON * 10;
}

export function validateAlgorithmConfig(config: AlgorithmConfig): readonly string[] {
  const errors: string[] = [];
  const allowedKinds = new Set<ReactionKind>(config.reactions.allowedKinds);
  const componentTotal = Object.values(config.matching.componentWeights).reduce(
    (total, weight) => total + weight,
    0,
  );

  if (!config.version.trim()) errors.push("version is required");
  if (
    allowedKinds.size !== 3 ||
    !allowedKinds.has("like") ||
    !allowedKinds.has("okay") ||
    !allowedKinds.has("dislike")
  ) {
    errors.push("exactly three reaction kinds are required");
  }
  if (config.reactions.minimumCountForEstablishedDistribution < 1) {
    errors.push("minimum reaction count must be positive");
  }
  if (!approximatelyOne(componentTotal)) {
    errors.push("matching component weights must sum to 1");
  }
  if (config.matching.minimumSimilarUserOverlap < 1) {
    errors.push("minimum similar-user overlap must be positive");
  }
  if (
    config.visitProof.locationMaximumDistanceMeters <= 0 ||
    config.visitProof.locationMaximumAccuracyMeters <= 0 ||
    config.visitProof.tokenValidityHours <= 0
  ) {
    errors.push("visit-proof limits must be positive");
  }
  if (
    config.creatorEvidence.metadataMaximumAgeDays < 1 ||
    config.creatorEvidence.metadataMaximumAgeDays > 30
  ) {
    errors.push("creator metadata must be refreshed within 30 days");
  }
  if (config.creatorEvidence.allowDerivedAuthorityScore !== false) {
    errors.push("derived creator authority scores are prohibited");
  }

  return errors;
}
