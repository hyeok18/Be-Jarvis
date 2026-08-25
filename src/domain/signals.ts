import { DEFAULT_ALGORITHM_CONFIG } from "./algorithm-config";
import type {
  AlgorithmConfig,
  CreatorEvidenceItem,
  ReactionCounts,
  ReactionModerationDecision,
  ReactionRiskCode,
  RestaurantMatchResult,
  RestaurantPreferenceProfile,
  RestaurantReaction,
  RestaurantReactionSummary,
  SimilarUserEvidence,
  UserPreferenceProfile,
  VisitHistoryEvidence,
  VisitProofMethod,
} from "./types";

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function assertPercent(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${label} must be between 0 and 100`);
  }
}

function weightedAverage(values: readonly { value: number; weight: number }[]) {
  const totalWeight = values.reduce((total, item) => total + item.weight, 0);
  if (totalWeight <= 0) throw new RangeError("at least one positive weight is required");
  return values.reduce((total, item) => total + item.value * item.weight, 0) / totalWeight;
}

export function summarizeRestaurantReactions(
  restaurantId: string,
  reactions: readonly RestaurantReaction[],
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
): RestaurantReactionSummary {
  const counted = reactions.filter(
    (reaction) =>
      reaction.restaurantId === restaurantId &&
      reaction.isActive &&
      reaction.moderationStatus === "counted",
  );
  const counts: ReactionCounts = { like: 0, okay: 0, dislike: 0 };

  for (const reaction of counted) {
    if (!config.reactions.allowedKinds.includes(reaction.kind)) {
      throw new RangeError(`unsupported reaction kind: ${reaction.kind}`);
    }
    counts[reaction.kind] += 1;
  }

  const countedTotal = counts.like + counts.okay + counts.dislike;
  const percentages =
    countedTotal === 0
      ? null
      : {
          like: roundTo(
            (counts.like / countedTotal) * 100,
            config.display.percentageDecimals,
          ),
          okay: roundTo(
            (counts.okay / countedTotal) * 100,
            config.display.percentageDecimals,
          ),
          dislike: roundTo(
            (counts.dislike / countedTotal) * 100,
            config.display.percentageDecimals,
          ),
        };

  return {
    restaurantId,
    counts,
    percentages,
    countedTotal,
    isForming:
      countedTotal < config.reactions.minimumCountForEstablishedDistribution,
    version: config.version,
  };
}

export function decideReactionModeration(input: {
  authenticated: boolean;
  visitProofMethod: VisitProofMethod;
  visitProofMatchesRestaurant: boolean;
  riskCodes?: readonly ReactionRiskCode[];
  config?: AlgorithmConfig;
}): ReactionModerationDecision {
  const config = input.config ?? DEFAULT_ALGORITHM_CONFIG;
  const riskCodes = [...new Set(input.riskCodes ?? [])];

  if (!input.authenticated) {
    return { status: "rejected", reasonCodes: ["AUTH_REQUIRED"] };
  }
  if (input.visitProofMethod === "none") {
    return { status: "private_only", reasonCodes: ["PRIVATE_PREFERENCE_ONLY"] };
  }
  if (!input.visitProofMatchesRestaurant) {
    return { status: "rejected", reasonCodes: ["VISIT_PROOF_MISMATCH"] };
  }
  const rejectRiskCodes = new Set<ReactionRiskCode>(
    config.abusePrevention.rejectRiskCodes,
  );
  const rejected = riskCodes.filter((code) => rejectRiskCodes.has(code));
  if (rejected.length > 0) return { status: "rejected", reasonCodes: rejected };

  const holdRiskCodes = new Set<ReactionRiskCode>(
    config.abusePrevention.holdRiskCodes,
  );
  const held = riskCodes.filter((code) => holdRiskCodes.has(code));
  if (held.length > 0) return { status: "held", reasonCodes: held };

  if (!config.visitProof.publicMethods.includes(input.visitProofMethod)) {
    return { status: "private_only", reasonCodes: ["PRIVATE_PREFERENCE_ONLY"] };
  }

  return { status: "counted", reasonCodes: [] };
}

export function isCreatorMetadataFresh(
  fetchedAt: string | null,
  now: string,
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
) {
  if (fetchedAt === null) return false;
  const fetchedAtMs = Date.parse(fetchedAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(fetchedAtMs) || !Number.isFinite(nowMs) || fetchedAtMs > nowMs) {
    return false;
  }
  const maximumAgeMs =
    config.creatorEvidence.metadataMaximumAgeDays * 24 * 60 * 60 * 1_000;
  return nowMs - fetchedAtMs <= maximumAgeMs;
}

export function selectPublishableCreatorEvidence(
  items: readonly CreatorEvidenceItem[],
  now: string,
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
) {
  return items
    .filter(({ channel, video, evidence }) => {
      const channelFresh = isCreatorMetadataFresh(
        channel.metadataFetchedAt,
        now,
        config,
      );
      const subscriberFresh =
        channel.hiddenSubscriberCount ||
        isCreatorMetadataFresh(channel.subscriberCountFetchedAt, now, config);
      const videoFresh = isCreatorMetadataFresh(video.metadataFetchedAt, now, config);

      return (
        channel.isAllowlisted &&
        channel.isActive &&
        video.isActive &&
        video.privacyStatus !== "private" &&
        evidence.status === "confirmed" &&
        evidence.confirmedAt !== null &&
        evidence.lastVerifiedAt !== null &&
        channelFresh &&
        subscriberFresh &&
        videoFresh
      );
    })
    .map((item) => {
      if (
        item.channel.subscriberCount !== null &&
        (!Number.isSafeInteger(item.channel.subscriberCount) ||
          item.channel.subscriberCount < 0)
      ) {
        throw new RangeError("subscriber count must be a non-negative safe integer");
      }
      return item;
    })
    .sort((left, right) => {
      const leftSubscriberCount = left.channel.hiddenSubscriberCount
        ? null
        : left.channel.subscriberCount;
      const rightSubscriberCount = right.channel.hiddenSubscriberCount
        ? null
        : right.channel.subscriberCount;

      if (leftSubscriberCount !== null && rightSubscriberCount !== null) {
        const subscriberDifference = rightSubscriberCount - leftSubscriberCount;
        if (subscriberDifference !== 0) return subscriberDifference;
      } else if (leftSubscriberCount !== null) {
        return -1;
      } else if (rightSubscriberCount !== null) {
        return 1;
      }

      return (
        Date.parse(right.video.publishedAt) - Date.parse(left.video.publishedAt) ||
        left.channel.title.localeCompare(right.channel.title, "ko")
      );
    });
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
  similarUserEvidence?: SimilarUserEvidence;
  visitEvidence?: VisitHistoryEvidence;
  config?: AlgorithmConfig;
}): RestaurantMatchResult {
  const config = input.config ?? DEFAULT_ALGORITHM_CONFIG;
  if (!input.profile.profileVersion.trim()) {
    throw new RangeError("a profile version is required");
  }

  const excludedTags = input.restaurant.foodTags.filter((tag) =>
    input.profile.excludedFoodTags.includes(tag),
  );
  if (excludedTags.length > 0) {
    return {
      restaurantId: input.restaurant.restaurantId,
      status: "excluded",
      matchPercent: 0,
      components: {
        contentFitPercent: null,
        similarUserFitPercent: null,
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
      components: {
        contentFitPercent: null,
        similarUserFitPercent: null,
        visitFitPercent: null,
      },
      reasons: [],
      excludedFoodTags: [],
    };
  }

  const similarUserFit =
    input.similarUserEvidence &&
    input.similarUserEvidence.overlapCount >= config.matching.minimumSimilarUserOverlap
      ? input.similarUserEvidence.fitPercent
      : null;
  const visitFit =
    input.visitEvidence && input.visitEvidence.sampleSize > 0
      ? input.visitEvidence.fitPercent
      : null;
  if (similarUserFit !== null) assertPercent(similarUserFit, "similar-user fit");
  if (visitFit !== null) assertPercent(visitFit, "visit fit");

  const availableComponents = [
    { value: contentFit, weight: config.matching.componentWeights.content },
    ...(similarUserFit === null
      ? []
      : [
          {
            value: similarUserFit,
            weight: config.matching.componentWeights.similarUsers,
          },
        ]),
    ...(visitFit === null
      ? []
      : [{ value: visitFit, weight: config.matching.componentWeights.visit }]),
  ];
  const matchPercent = weightedAverage(availableComponents);

  return {
    restaurantId: input.restaurant.restaurantId,
    status: "matched",
    matchPercent: roundTo(matchPercent, config.display.matchDecimals),
    components: {
      contentFitPercent: roundTo(contentFit, config.display.matchDecimals),
      similarUserFitPercent: similarUserFit,
      visitFitPercent: visitFit,
    },
    reasons: [
      "DIRECT_PREFERENCE",
      ...(similarUserFit === null ? [] : (["SIMILAR_USERS"] as const)),
      ...(visitFit === null ? [] : (["VISIT_HISTORY"] as const)),
      ...(similarUserFit === null && visitFit === null
        ? (["COLD_START_CONTENT_ONLY"] as const)
        : []),
    ],
    excludedFoodTags: [],
  };
}
