import { describe, expect, it, vi } from "vitest";

import type { CreatorAllowlistEntry } from "../src/server/youtube/creator-allowlist";
import type {
  YouTubeDataApiClient,
  YouTubeVideo,
} from "../src/server/youtube/youtube-data-api";
import {
  createYouTubeSyncService,
  findRestaurantCandidates,
  type YouTubeSyncRepository,
} from "../src/server/youtube/youtube-sync";

const now = new Date("2026-08-25T08:00:00.000Z");
const allowlist: CreatorAllowlistEntry[] = [
  {
    youtubeChannelId: "channel-1",
    handle: "@one",
    expectedTitle: "채널 하나",
    channelUrl: "https://www.youtube.com/@one",
  },
  {
    youtubeChannelId: "channel-2",
    handle: "@two",
    expectedTitle: "채널 둘",
    channelUrl: "https://www.youtube.com/@two",
  },
];

const publicVideo: YouTubeVideo = {
  youtubeVideoId: "video-1",
  youtubeChannelId: "channel-1",
  title: "오늘은 모의식당에 방문했습니다",
  descriptionExcerpt: "정상적인 공식 영상 설명",
  thumbnailUrl: "https://i.ytimg.com/video.jpg",
  publishedAt: "2026-08-24T00:00:00.000Z",
  privacyStatus: "public",
};

function createRepository(
  overrides: Partial<YouTubeSyncRepository> = {},
): YouTubeSyncRepository {
  return {
    startRun: vi.fn(async () => ({ id: "run-1" })),
    finishRun: vi.fn(async () => undefined),
    upsertChannel: vi.fn(async (channel) => ({
      id: `stored-${channel.youtubeChannelId}`,
      youtubeChannelId: channel.youtubeChannelId,
    })),
    listVideos: vi.fn(async () => []),
    upsertVideos: vi.fn(async ({ videos }) =>
      videos.map((video: YouTubeVideo) => ({
        id: `stored-${video.youtubeVideoId}`,
        youtubeVideoId: video.youtubeVideoId,
        title: video.title,
        descriptionExcerpt: video.descriptionExcerpt,
        privacyStatus: video.privacyStatus,
        isActive: video.privacyStatus === "public",
      })),
    ),
    markVideosUnavailable: vi.fn(async () => undefined),
    refreshConfirmedEvidence: vi.fn(async () => undefined),
    listActiveRestaurants: vi.fn(async () => [
      { id: "restaurant-1", name: "모의식당" },
    ]),
    createCandidateEvidence: vi.fn(async (candidates) => candidates.length),
    ...overrides,
  };
}

function createYouTubeClient(
  overrides: Partial<YouTubeDataApiClient> = {},
): YouTubeDataApiClient {
  return {
    listChannels: vi.fn(async () => [
      {
        youtubeChannelId: "channel-1",
        title: "채널 하나",
        thumbnailUrl: null,
        subscriberCount: 100,
        subscriberCountHidden: false,
        uploadsPlaylistId: "uploads-1",
      },
      {
        youtubeChannelId: "channel-2",
        title: "채널 둘",
        thumbnailUrl: null,
        subscriberCount: null,
        subscriberCountHidden: true,
        uploadsPlaylistId: "uploads-2",
      },
    ]),
    listPlaylistPage: vi.fn(async () => ({
      videoIds: ["video-1"],
      nextPageToken: null,
    })),
    listVideos: vi.fn(async () => [publicVideo]),
    getRequestCount: vi.fn(() => 4),
    ...overrides,
  };
}

describe("creator visit candidate matching", () => {
  it("matches normalized restaurant names without inventing a trust score", () => {
    const matches = findRestaurantCandidates(
      {
        title: "[서울 맛집] 모의 식당 방문기",
        descriptionExcerpt: null,
      },
      [
        { id: "restaurant-1", name: "모의식당" },
        { id: "restaurant-2", name: "다른식당" },
      ],
    );

    expect(matches).toEqual([{ id: "restaurant-1", name: "모의식당" }]);
  });
});

describe("WU-12 YouTube incremental sync", () => {
  it("continues after one channel fails and stores unconfirmed evidence privately", async () => {
    const repository = createRepository();
    const youtube = createYouTubeClient({
      listPlaylistPage: vi.fn(async (playlistId) => {
        if (playlistId === "uploads-2") {
          throw Object.assign(new Error("must not leak"), { kind: "unavailable" });
        }

        return { videoIds: ["video-1"], nextPageToken: null };
      }),
    });
    const service = createYouTubeSyncService({
      youtube,
      repository,
      allowlist,
      now: () => now,
    });

    const result = await service.sync("manual");

    expect(result).toEqual({
      runId: "run-1",
      status: "partial",
      successfulChannelCount: 1,
      failedChannelCount: 1,
      processedVideoCount: 1,
      candidateCount: 1,
      apiRequestCount: 4,
    });
    expect(repository.createCandidateEvidence).toHaveBeenCalledWith([
      {
        creatorVideoId: "stored-video-1",
        restaurantId: "restaurant-1",
      },
    ]);
    expect(repository.finishRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "partial",
        errorSummary: "channel-2:unavailable",
      }),
    );
  });

  it("does not request metadata again when the known page is still fresh", async () => {
    const repository = createRepository({
      listVideos: vi.fn(async () => [
        {
          id: "stored-video-1",
          youtubeVideoId: "video-1",
          metadataFetchedAt: "2026-08-24T08:00:00.000Z",
        },
      ]),
    });
    const listVideos = vi.fn(async () => [publicVideo]);
    const youtube = createYouTubeClient({ listVideos });
    const service = createYouTubeSyncService({
      youtube,
      repository,
      allowlist: [allowlist[0]],
      now: () => now,
    });

    const result = await service.sync("cron");

    expect(result.status).toBe("succeeded");
    expect(result.processedVideoCount).toBe(0);
    expect(listVideos).not.toHaveBeenCalled();
    expect(repository.upsertVideos).not.toHaveBeenCalled();
  });

  it("marks a stored video and its evidence stale when YouTube omits it", async () => {
    const repository = createRepository({
      listVideos: vi.fn(async () => [
        {
          id: "stored-deleted-video",
          youtubeVideoId: "deleted-video",
          metadataFetchedAt: "2026-07-01T00:00:00.000Z",
        },
      ]),
    });
    const youtube = createYouTubeClient({
      listPlaylistPage: vi.fn(async () => ({
        videoIds: ["deleted-video"],
        nextPageToken: null,
      })),
      listVideos: vi.fn(async () => []),
    });
    const service = createYouTubeSyncService({
      youtube,
      repository,
      allowlist: [allowlist[0]],
      now: () => now,
    });

    const result = await service.sync("cron");

    expect(result.status).toBe("succeeded");
    expect(repository.markVideosUnavailable).toHaveBeenCalledWith({
      videoIds: ["stored-deleted-video"],
      metadataFetchedAt: now.toISOString(),
    });
  });
});
