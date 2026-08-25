import type { CreatorAllowlistEntry } from "./creator-allowlist";
import type {
  YouTubeChannel,
  YouTubeDataApiClient,
  YouTubeVideo,
} from "./youtube-data-api";

const dataRefreshWindowMs = 30 * 24 * 60 * 60 * 1000;

export type SyncTriggerKind = "manual" | "cron";
export type SyncRunStatus = "succeeded" | "partial" | "failed";

export type StoredCreatorChannel = {
  id: string;
  youtubeChannelId: string;
};

export type StoredCreatorVideo = {
  id: string;
  youtubeVideoId: string;
  metadataFetchedAt: string;
};

export type StoredSyncedVideo = {
  id: string;
  youtubeVideoId: string;
  title: string;
  descriptionExcerpt: string | null;
  privacyStatus: YouTubeVideo["privacyStatus"];
  isActive: boolean;
};

export type ActiveRestaurant = {
  id: string;
  name: string;
};

export type YouTubeSyncRepository = {
  startRun(triggerKind: SyncTriggerKind, startedAt: string): Promise<{ id: string }>;
  finishRun(input: {
    runId: string;
    status: SyncRunStatus;
    apiRequestCount: number;
    processedVideoCount: number;
    candidateCount: number;
    errorSummary: string | null;
    finishedAt: string;
  }): Promise<void>;
  upsertChannel(
    channel: YouTubeChannel,
    metadataFetchedAt: string,
  ): Promise<StoredCreatorChannel>;
  listVideos(channelId: string): Promise<StoredCreatorVideo[]>;
  upsertVideos(input: {
    channelId: string;
    videos: readonly YouTubeVideo[];
    metadataFetchedAt: string;
  }): Promise<StoredSyncedVideo[]>;
  markVideosUnavailable(input: {
    videoIds: readonly string[];
    metadataFetchedAt: string;
  }): Promise<void>;
  refreshConfirmedEvidence(input: {
    videoIds: readonly string[];
    verifiedAt: string;
  }): Promise<void>;
  listActiveRestaurants(): Promise<ActiveRestaurant[]>;
  createCandidateEvidence(
    candidates: readonly { creatorVideoId: string; restaurantId: string }[],
  ): Promise<number>;
};

type YouTubeSyncOptions = {
  youtube: YouTubeDataApiClient;
  repository: YouTubeSyncRepository;
  allowlist: readonly CreatorAllowlistEntry[];
  now?: () => Date;
  maxPlaylistPages?: number;
};

export type YouTubeSyncResult = {
  runId: string;
  status: SyncRunStatus;
  successfulChannelCount: number;
  failedChannelCount: number;
  processedVideoCount: number;
  candidateCount: number;
  apiRequestCount: number;
};

function normalizeForMatch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function findRestaurantCandidates(
  video: Pick<StoredSyncedVideo, "title" | "descriptionExcerpt">,
  restaurants: readonly ActiveRestaurant[],
) {
  const searchableText = normalizeForMatch(
    `${video.title} ${video.descriptionExcerpt ?? ""}`,
  );

  return restaurants.filter((restaurant) => {
    const normalizedName = normalizeForMatch(restaurant.name);
    return normalizedName.length >= 2 && searchableText.includes(normalizedName);
  });
}

function shouldRefresh(metadataFetchedAt: string, now: Date) {
  const fetchedAt = Date.parse(metadataFetchedAt);
  return (
    Number.isNaN(fetchedAt) || now.getTime() - fetchedAt >= dataRefreshWindowMs
  );
}

function safeErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "kind" in error &&
    typeof error.kind === "string"
  ) {
    return error.kind.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
  }

  return "unexpected";
}

function createErrorSummary(errors: readonly string[]) {
  if (errors.length === 0) return null;
  return errors.join("; ").slice(0, 2000);
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

export function createYouTubeSyncService(options: YouTubeSyncOptions) {
  const now = options.now ?? (() => new Date());
  const maxPlaylistPages = Math.max(1, options.maxPlaylistPages ?? 2);

  async function collectPlaylistVideoIds(
    playlistId: string,
    knownIds: ReadonlySet<string>,
  ) {
    const collectedIds: string[] = [];
    let pageToken: string | null = null;

    for (let pageIndex = 0; pageIndex < maxPlaylistPages; pageIndex += 1) {
      const page = await options.youtube.listPlaylistPage(playlistId, pageToken);
      collectedIds.push(...page.videoIds);

      const allIdsKnown =
        page.videoIds.length > 0 &&
        page.videoIds.every((videoId) => knownIds.has(videoId));

      if (allIdsKnown || !page.nextPageToken) break;
      pageToken = page.nextPageToken;
    }

    return unique(collectedIds);
  }

  async function syncChannel(
    channel: YouTubeChannel,
    fetchedAt: string,
    restaurants: readonly ActiveRestaurant[],
  ) {
    const storedChannel = await options.repository.upsertChannel(
      channel,
      fetchedAt,
    );
    const storedVideos = await options.repository.listVideos(storedChannel.id);
    const storedByYouTubeId = new Map(
      storedVideos.map((video) => [video.youtubeVideoId, video]),
    );
    const playlistIds = await collectPlaylistVideoIds(
      channel.uploadsPlaylistId,
      new Set(storedByYouTubeId.keys()),
    );
    const newVideoIds = playlistIds.filter(
      (videoId) => !storedByYouTubeId.has(videoId),
    );
    const staleVideoIds = storedVideos
      .filter((video) => shouldRefresh(video.metadataFetchedAt, new Date(fetchedAt)))
      .map((video) => video.youtubeVideoId);
    const videoIdsToRefresh = unique([...newVideoIds, ...staleVideoIds]);

    if (videoIdsToRefresh.length === 0) {
      return { processedVideoCount: 0, candidateCount: 0 };
    }

    const videos = await options.youtube.listVideos(videoIdsToRefresh);
    const returnedIds = new Set(videos.map((video) => video.youtubeVideoId));
    const missingStoredIds = videoIdsToRefresh.flatMap((youtubeVideoId) => {
      if (returnedIds.has(youtubeVideoId)) return [];
      const stored = storedByYouTubeId.get(youtubeVideoId);
      return stored ? [stored.id] : [];
    });

    await options.repository.markVideosUnavailable({
      videoIds: missingStoredIds,
      metadataFetchedAt: fetchedAt,
    });

    const channelVideos = videos.filter(
      (video) => video.youtubeChannelId === channel.youtubeChannelId,
    );
    const syncedVideos = await options.repository.upsertVideos({
      channelId: storedChannel.id,
      videos: channelVideos,
      metadataFetchedAt: fetchedAt,
    });
    const activeVideoIds = syncedVideos
      .filter((video) => video.isActive)
      .map((video) => video.id);

    await options.repository.refreshConfirmedEvidence({
      videoIds: activeVideoIds,
      verifiedAt: fetchedAt,
    });

    const candidates = syncedVideos.flatMap((video) => {
      if (!video.isActive || video.privacyStatus !== "public") return [];

      return findRestaurantCandidates(video, restaurants).map((restaurant) => ({
        creatorVideoId: video.id,
        restaurantId: restaurant.id,
      }));
    });
    const candidateCount =
      await options.repository.createCandidateEvidence(candidates);

    return {
      processedVideoCount: syncedVideos.length,
      candidateCount,
    };
  }

  return {
    async sync(triggerKind: SyncTriggerKind): Promise<YouTubeSyncResult> {
      const startedAt = now().toISOString();
      const run = await options.repository.startRun(triggerKind, startedAt);
      const errors: string[] = [];
      let successfulChannelCount = 0;
      let processedVideoCount = 0;
      let candidateCount = 0;

      try {
        const channelIds = options.allowlist.map(
          (entry) => entry.youtubeChannelId,
        );
        const channels = await options.youtube.listChannels(channelIds);
        const channelsById = new Map(
          channels.map((channel) => [channel.youtubeChannelId, channel]),
        );
        const restaurants = await options.repository.listActiveRestaurants();

        for (const entry of options.allowlist) {
          const channel = channelsById.get(entry.youtubeChannelId);

          if (!channel) {
            errors.push(`${entry.youtubeChannelId}:not_found`);
            continue;
          }

          try {
            const result = await syncChannel(channel, startedAt, restaurants);
            processedVideoCount += result.processedVideoCount;
            candidateCount += result.candidateCount;
            successfulChannelCount += 1;
          } catch (error) {
            errors.push(`${entry.youtubeChannelId}:${safeErrorCode(error)}`);
          }
        }
      } catch (error) {
        errors.push(`sync:${safeErrorCode(error)}`);
      }

      const failedChannelCount = options.allowlist.length - successfulChannelCount;
      const status: SyncRunStatus =
        failedChannelCount === 0
          ? "succeeded"
          : successfulChannelCount > 0
            ? "partial"
            : "failed";
      const apiRequestCount = options.youtube.getRequestCount();
      const finishedAt = now().toISOString();

      await options.repository.finishRun({
        runId: run.id,
        status,
        apiRequestCount,
        processedVideoCount,
        candidateCount,
        errorSummary: createErrorSummary(errors),
        finishedAt,
      });

      return {
        runId: run.id,
        status,
        successfulChannelCount,
        failedChannelCount,
        processedVideoCount,
        candidateCount,
        apiRequestCount,
      };
    },
  };
}

export type YouTubeSyncService = ReturnType<typeof createYouTubeSyncService>;
