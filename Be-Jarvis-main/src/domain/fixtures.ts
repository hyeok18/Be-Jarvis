import type {
  CreatorChannel,
  CreatorEvidenceItem,
  CreatorVideo,
  CreatorVisitEvidence,
  Restaurant,
  RestaurantPreferenceProfile,
  RestaurantReaction,
  UserPreferenceProfile,
  VisitProof,
} from "./types";

const FIXTURE_TIME = "2026-08-25T00:00:00.000Z";

export const DOMAIN_FIXTURE = {
  now: "2026-08-25T12:00:00.000Z",
  restaurants: [] satisfies readonly Restaurant[],
  visitProofs: [
    {
      id: "proof-location-001",
      userId: "synthetic-user-a",
      restaurantId: "restaurant-balanced-bowl",
      method: "location_checkin",
      status: "verified",
      evidenceDigest: "synthetic-digest-a",
      verifiedAt: "2026-08-25T09:00:00.000Z",
      expiresAt: "2026-08-26T09:00:00.000Z",
      usedAt: "2026-08-25T09:01:00.000Z",
      createdAt: "2026-08-25T09:00:00.000Z",
    },
  ] satisfies readonly VisitProof[],
  reactions: [
    {
      id: "reaction-like-counted",
      userId: "synthetic-user-a",
      restaurantId: "restaurant-balanced-bowl",
      visitProofId: "proof-location-001",
      kind: "like",
      moderationStatus: "counted",
      riskCodes: [],
      isActive: true,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    },
    {
      id: "reaction-okay-counted",
      userId: "synthetic-user-b",
      restaurantId: "restaurant-balanced-bowl",
      visitProofId: "proof-location-002",
      kind: "okay",
      moderationStatus: "counted",
      riskCodes: [],
      isActive: true,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    },
    {
      id: "reaction-dislike-counted",
      userId: "synthetic-user-c",
      restaurantId: "restaurant-balanced-bowl",
      visitProofId: "proof-location-003",
      kind: "dislike",
      moderationStatus: "counted",
      riskCodes: [],
      isActive: true,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    },
    {
      id: "reaction-like-held",
      userId: "synthetic-user-d",
      restaurantId: "restaurant-balanced-bowl",
      visitProofId: "proof-location-004",
      kind: "like",
      moderationStatus: "held",
      riskCodes: ["REACTION_BURST"],
      isActive: true,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    },
    {
      id: "reaction-like-private",
      userId: "synthetic-user-e",
      restaurantId: "restaurant-balanced-bowl",
      visitProofId: null,
      kind: "like",
      moderationStatus: "private_only",
      riskCodes: [],
      isActive: true,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    },
    {
      id: "reaction-shellfish-counted",
      userId: "synthetic-user-f",
      restaurantId: "restaurant-shellfish-table",
      visitProofId: "proof-location-005",
      kind: "like",
      moderationStatus: "counted",
      riskCodes: [],
      isActive: true,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    },
  ] satisfies readonly RestaurantReaction[],
  userProfile: {
    profileVersion: "preference-v2",
    axisPreferences: {
      spicy: 80,
      rich: 70,
      cleanliness: 100,
      service: 80,
    },
    excludedFoodTags: ["shellfish"],
    onboardingSources: ["balance_game", "direct_input", "reaction_history"],
    updatedAt: FIXTURE_TIME,
  } satisfies UserPreferenceProfile,
  restaurantProfiles: [
    {
      restaurantId: "restaurant-balanced-bowl",
      axisProfile: {
        spicy: 70,
        sweet: 30,
        light: 50,
        rich: 70,
        value: 75,
        cleanliness: 90,
        service: 70,
      },
      foodTags: ["rice", "beef"],
    },
    {
      restaurantId: "restaurant-shellfish-table",
      axisProfile: {
        spicy: 20,
        sweet: 20,
        light: 65,
        rich: 80,
        value: 55,
        cleanliness: 85,
        service: 80,
      },
      foodTags: ["shellfish", "seafood"],
    },
  ] satisfies readonly RestaurantPreferenceProfile[],
} as const;

const channels = [
  {
    id: "creator-large",
    youtubeChannelId: "youtube-channel-large",
    title: "합성 대형 맛집 채널",
    thumbnailUrl: "https://example.invalid/large-channel.jpg",
    subscriberCount: 2_300_000,
    hiddenSubscriberCount: false,
    subscriberCountFetchedAt: "2026-08-24T00:00:00.000Z",
    uploadsPlaylistId: "uploads-large",
    isAllowlisted: true,
    isActive: true,
    metadataFetchedAt: "2026-08-24T00:00:00.000Z",
  },
  {
    id: "creator-small",
    youtubeChannelId: "youtube-channel-small",
    title: "합성 소형 맛집 채널",
    thumbnailUrl: "https://example.invalid/small-channel.jpg",
    subscriberCount: 120_000,
    hiddenSubscriberCount: false,
    subscriberCountFetchedAt: "2026-08-24T00:00:00.000Z",
    uploadsPlaylistId: "uploads-small",
    isAllowlisted: true,
    isActive: true,
    metadataFetchedAt: "2026-08-24T00:00:00.000Z",
  },
  {
    id: "creator-hidden",
    youtubeChannelId: "youtube-channel-hidden",
    title: "합성 구독자 비공개 채널",
    thumbnailUrl: null,
    subscriberCount: null,
    hiddenSubscriberCount: true,
    subscriberCountFetchedAt: null,
    uploadsPlaylistId: "uploads-hidden",
    isAllowlisted: true,
    isActive: true,
    metadataFetchedAt: "2026-08-24T00:00:00.000Z",
  },
  {
    id: "creator-stale",
    youtubeChannelId: "youtube-channel-stale",
    title: "합성 오래된 채널",
    thumbnailUrl: null,
    subscriberCount: 9_900_000,
    hiddenSubscriberCount: false,
    subscriberCountFetchedAt: "2026-07-01T00:00:00.000Z",
    uploadsPlaylistId: "uploads-stale",
    isAllowlisted: true,
    isActive: true,
    metadataFetchedAt: "2026-07-01T00:00:00.000Z",
  },
] satisfies readonly CreatorChannel[];

function createCreatorItem(
  channel: (typeof channels)[number],
  options: {
    videoId: string;
    publishedAt: string;
    status?: CreatorVisitEvidence["status"];
  },
): CreatorEvidenceItem {
  const video = {
    id: `video-${options.videoId}`,
    youtubeVideoId: options.videoId,
    creatorChannelId: channel.id,
    title: `${channel.title}의 합성 성수 방문 영상`,
    descriptionExcerpt: "YouTube Data API fixture",
    thumbnailUrl: `https://example.invalid/${options.videoId}.jpg`,
    publishedAt: options.publishedAt,
    privacyStatus: "public",
    metadataFetchedAt: channel.metadataFetchedAt,
    isActive: true,
  } satisfies CreatorVideo;
  const status = options.status ?? "confirmed";
  const evidence = {
    id: `evidence-${options.videoId}`,
    creatorVideoId: video.id,
    restaurantId: "restaurant-balanced-bowl",
    status,
    evidenceTimestampSeconds: 180,
    matchNotes: "합성 fixture — 실제 YouTube 데이터가 아님",
    confirmedBy: status === "confirmed" ? "synthetic-admin" : null,
    confirmedAt: status === "confirmed" ? "2026-08-25T01:00:00.000Z" : null,
    lastVerifiedAt: status === "confirmed" ? "2026-08-25T01:00:00.000Z" : null,
  } satisfies CreatorVisitEvidence;

  return { channel, video, evidence };
}

export const CREATOR_EVIDENCE_FIXTURE = [
  createCreatorItem(channels[1], {
    videoId: "synthetic-small-video",
    publishedAt: "2026-08-22T00:00:00.000Z",
  }),
  createCreatorItem(channels[0], {
    videoId: "synthetic-large-video",
    publishedAt: "2026-08-20T00:00:00.000Z",
  }),
  createCreatorItem(channels[2], {
    videoId: "synthetic-hidden-video",
    publishedAt: "2026-08-24T00:00:00.000Z",
  }),
  createCreatorItem(channels[3], {
    videoId: "synthetic-stale-video",
    publishedAt: "2026-06-30T00:00:00.000Z",
  }),
  createCreatorItem(channels[0], {
    videoId: "synthetic-candidate-video",
    publishedAt: "2026-08-25T00:00:00.000Z",
    status: "candidate",
  }),
] satisfies readonly CreatorEvidenceItem[];
