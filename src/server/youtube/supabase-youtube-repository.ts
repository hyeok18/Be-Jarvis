import type { YouTubeChannel } from "./youtube-data-api";
import type {
  ActiveRestaurant,
  StoredCreatorChannel,
  StoredCreatorVideo,
  StoredSyncedVideo,
  SyncTriggerKind,
  YouTubeSyncRepository,
} from "./youtube-sync";

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SupabaseEnvironment = Readonly<Record<string, string | undefined>>;

type RepositoryOptions = {
  fetch?: Fetch;
  timeoutMs?: number;
};

export class YouTubeRepositoryError extends Error {
  constructor(
    readonly kind: "configuration" | "timeout" | "unavailable" | "invalid_response",
    readonly httpStatus: number | null = null,
  ) {
    super(kind);
    this.name = "YouTubeRepositoryError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function requireEnvironmentValue(
  environment: SupabaseEnvironment,
  key: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SECRET_KEY",
) {
  const value = environment[key]?.trim();

  if (!value) throw new YouTubeRepositoryError("configuration");
  return value;
}

function createRestUrl(
  baseUrl: string,
  table: string,
  query: Readonly<Record<string, string>> = {},
) {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    throw new YouTubeRepositoryError("configuration");
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new YouTubeRepositoryError("configuration");
  }

  url.pathname = `/rest/v1/${table}`;
  url.search = "";
  url.hash = "";

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  return url;
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function inFilter(values: readonly string[]) {
  return `in.(${unique(values).join(",")})`;
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new YouTubeRepositoryError("invalid_response", response.status);
  }
}

function parseChannel(value: unknown): StoredCreatorChannel {
  if (!isRecord(value)) throw new YouTubeRepositoryError("invalid_response");
  const id = readString(value.id);
  const youtubeChannelId = readString(value.youtube_channel_id);

  if (!id || !youtubeChannelId) {
    throw new YouTubeRepositoryError("invalid_response");
  }

  return { id, youtubeChannelId };
}

function parseStoredVideo(value: unknown): StoredCreatorVideo {
  if (!isRecord(value)) throw new YouTubeRepositoryError("invalid_response");
  const id = readString(value.id);
  const youtubeVideoId = readString(value.youtube_video_id);
  const metadataFetchedAt = readString(value.metadata_fetched_at);

  if (!id || !youtubeVideoId || !metadataFetchedAt) {
    throw new YouTubeRepositoryError("invalid_response");
  }

  return { id, youtubeVideoId, metadataFetchedAt };
}

function parseSyncedVideo(value: unknown): StoredSyncedVideo {
  if (!isRecord(value)) throw new YouTubeRepositoryError("invalid_response");
  const id = readString(value.id);
  const youtubeVideoId = readString(value.youtube_video_id);
  const title = readString(value.title);
  const description = value.description_excerpt;
  const privacyStatus = readString(value.privacy_status);
  const isActive = readBoolean(value.is_active);

  if (
    !id ||
    !youtubeVideoId ||
    !title ||
    (description !== null && typeof description !== "string") ||
    (privacyStatus !== "public" &&
      privacyStatus !== "unlisted" &&
      privacyStatus !== "private" &&
      privacyStatus !== "unknown") ||
    isActive === null
  ) {
    throw new YouTubeRepositoryError("invalid_response");
  }

  return {
    id,
    youtubeVideoId,
    title,
    descriptionExcerpt: description,
    privacyStatus,
    isActive,
  };
}

export function createSupabaseYouTubeRepository(
  environment: SupabaseEnvironment,
  options: RepositoryOptions = {},
): YouTubeSyncRepository {
  const baseUrl = requireEnvironmentValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const secretKey = requireEnvironmentValue(environment, "SUPABASE_SECRET_KEY");
  const fetchImplementation = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function request(
    table: string,
    init: RequestInit,
    query: Readonly<Record<string, string>> = {},
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImplementation(
        createRestUrl(baseUrl, table, query),
        {
          ...init,
          headers: {
            Accept: "application/json",
            apikey: secretKey,
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...init.headers,
          },
          cache: "no-store",
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new YouTubeRepositoryError("unavailable", response.status);
      }

      return response;
    } catch (error) {
      if (error instanceof YouTubeRepositoryError) throw error;
      if (controller.signal.aborted) {
        throw new YouTubeRepositoryError("timeout");
      }
      throw new YouTubeRepositoryError("unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function requestRows(
    table: string,
    init: RequestInit,
    query: Readonly<Record<string, string>> = {},
  ) {
    const response = await request(table, init, query);
    const value = await readJson(response);

    if (!Array.isArray(value)) {
      throw new YouTubeRepositoryError("invalid_response");
    }

    return value;
  }

  return {
    async startRun(triggerKind: SyncTriggerKind, startedAt: string) {
      const rows = await requestRows(
        "youtube_sync_runs",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: "running",
            trigger_kind: triggerKind,
            started_at: startedAt,
          }),
        },
        { select: "id" },
      );
      const id = isRecord(rows[0]) ? readString(rows[0].id) : null;

      if (!id) throw new YouTubeRepositoryError("invalid_response");
      return { id };
    },

    async finishRun(input) {
      await request(
        "youtube_sync_runs",
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: input.status,
            api_request_count: input.apiRequestCount,
            processed_video_count: input.processedVideoCount,
            candidate_count: input.candidateCount,
            error_summary: input.errorSummary,
            finished_at: input.finishedAt,
          }),
        },
        { id: `eq.${input.runId}` },
      );
    },

    async upsertChannel(channel: YouTubeChannel, metadataFetchedAt: string) {
      const rows = await requestRows(
        "creator_channels",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify({
            youtube_channel_id: channel.youtubeChannelId,
            title: channel.title,
            thumbnail_url: channel.thumbnailUrl,
            subscriber_count: channel.subscriberCount,
            subscriber_count_hidden: channel.subscriberCountHidden,
            subscriber_count_fetched_at: metadataFetchedAt,
            uploads_playlist_id: channel.uploadsPlaylistId,
            is_allowlisted: true,
            is_active: true,
            metadata_fetched_at: metadataFetchedAt,
          }),
        },
        {
          on_conflict: "youtube_channel_id",
          select: "id,youtube_channel_id",
        },
      );

      return parseChannel(rows[0]);
    },

    async listVideos(channelId: string) {
      const rows = await requestRows(
        "creator_videos",
        { method: "GET" },
        {
          select: "id,youtube_video_id,metadata_fetched_at",
          creator_channel_id: `eq.${channelId}`,
        },
      );

      return rows.map(parseStoredVideo);
    },

    async upsertVideos(input) {
      if (input.videos.length === 0) return [];

      const rows = await requestRows(
        "creator_videos",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(
            input.videos.map((video) => ({
              youtube_video_id: video.youtubeVideoId,
              creator_channel_id: input.channelId,
              title: video.title,
              description_excerpt: video.descriptionExcerpt,
              thumbnail_url: video.thumbnailUrl,
              published_at: video.publishedAt,
              privacy_status: video.privacyStatus,
              metadata_fetched_at: input.metadataFetchedAt,
              is_active: video.privacyStatus === "public",
            })),
          ),
        },
        {
          on_conflict: "youtube_video_id",
          select:
            "id,youtube_video_id,title,description_excerpt,privacy_status,is_active",
        },
      );

      return rows.map(parseSyncedVideo);
    },

    async markVideosUnavailable(input) {
      if (input.videoIds.length === 0) return;

      await request(
        "creator_videos",
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            privacy_status: "deleted",
            is_active: false,
            metadata_fetched_at: input.metadataFetchedAt,
          }),
        },
        { id: inFilter(input.videoIds) },
      );

      await request(
        "creator_visit_evidence",
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "stale" }),
        },
        {
          creator_video_id: inFilter(input.videoIds),
          status: "in.(candidate,confirmed)",
        },
      );
    },

    async refreshConfirmedEvidence(input) {
      if (input.videoIds.length === 0) return;

      await request(
        "creator_visit_evidence",
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ last_verified_at: input.verifiedAt }),
        },
        {
          creator_video_id: inFilter(input.videoIds),
          status: "eq.confirmed",
        },
      );
    },

    async listActiveRestaurants(): Promise<ActiveRestaurant[]> {
      const rows = await requestRows(
        "restaurants",
        { method: "GET" },
        { select: "id,name", is_active: "eq.true" },
      );

      return rows.map((row) => {
        if (!isRecord(row)) {
          throw new YouTubeRepositoryError("invalid_response");
        }
        const id = readString(row.id);
        const name = readString(row.name);

        if (!id || !name) {
          throw new YouTubeRepositoryError("invalid_response");
        }

        return { id, name };
      });
    },

    async createCandidateEvidence(candidates) {
      if (candidates.length === 0) return 0;

      const rows = await requestRows(
        "creator_visit_evidence",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=ignore-duplicates,return=representation",
          },
          body: JSON.stringify(
            candidates.map((candidate) => ({
              creator_video_id: candidate.creatorVideoId,
              restaurant_id: candidate.restaurantId,
              status: "candidate",
            })),
          ),
        },
        {
          on_conflict: "creator_video_id,restaurant_id",
          select: "id",
        },
      );

      return rows.length;
    },
  };
}
