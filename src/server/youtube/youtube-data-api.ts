const youtubeApiOrigin = "https://www.googleapis.com";
const youtubeApiPrefix = "/youtube/v3";
const maximumIdsPerRequest = 50;

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type YouTubeClientOptions = {
  apiKey: string;
  fetch?: Fetch;
  timeoutMs?: number;
};

export type YouTubeChannel = {
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  subscriberCountHidden: boolean;
  uploadsPlaylistId: string;
};

export type YouTubePlaylistPage = {
  videoIds: string[];
  nextPageToken: string | null;
};

export type YouTubeVideo = {
  youtubeVideoId: string;
  youtubeChannelId: string;
  title: string;
  descriptionExcerpt: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  privacyStatus: "public" | "unlisted" | "private" | "unknown";
};

export class YouTubeDataApiError extends Error {
  constructor(
    readonly kind: "configuration" | "timeout" | "unavailable" | "invalid_response",
    readonly httpStatus: number | null = null,
  ) {
    super(kind);
    this.name = "YouTubeDataApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readIsoDate(value: unknown) {
  const text = readString(value);

  if (!text || Number.isNaN(Date.parse(text))) {
    return null;
  }

  return new Date(text).toISOString();
}

function readThumbnailUrl(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  for (const size of ["maxres", "standard", "high", "medium", "default"]) {
    const thumbnail = value[size];

    if (isRecord(thumbnail)) {
      const url = readString(thumbnail.url);
      if (url) return url;
    }
  }

  return null;
}

function readSubscriberCount(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function splitIntoBatches<T>(values: readonly T[], size = maximumIdsPerRequest) {
  const batches: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }

  return batches;
}

function uniqueNonBlank(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new YouTubeDataApiError("invalid_response", response.status);
  }
}

export function createYouTubeDataApiClient(options: YouTubeClientOptions) {
  const apiKey = options.apiKey.trim();
  const fetchImplementation = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  let requestCount = 0;

  if (!apiKey) {
    throw new YouTubeDataApiError("configuration");
  }

  async function request(path: string, parameters: Record<string, string>) {
    const url = new URL(`${youtubeApiPrefix}/${path}`, youtubeApiOrigin);

    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("key", apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    requestCount += 1;

    try {
      const response = await fetchImplementation(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new YouTubeDataApiError("unavailable", response.status);
      }

      return await readJson(response);
    } catch (error) {
      if (error instanceof YouTubeDataApiError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new YouTubeDataApiError("timeout");
      }

      throw new YouTubeDataApiError("unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function listChannels(channelIds: readonly string[]) {
    const channels: YouTubeChannel[] = [];

    for (const batch of splitIntoBatches(uniqueNonBlank(channelIds))) {
      if (batch.length === 0) continue;

      const payload = await request("channels", {
        part: "snippet,statistics,contentDetails",
        id: batch.join(","),
        maxResults: String(maximumIdsPerRequest),
      });

      if (!isRecord(payload) || !Array.isArray(payload.items)) {
        throw new YouTubeDataApiError("invalid_response");
      }

      for (const item of payload.items) {
        if (!isRecord(item)) continue;

        const snippet = item.snippet;
        const statistics = item.statistics;
        const contentDetails = item.contentDetails;
        const id = readString(item.id);
        const title = isRecord(snippet) ? readString(snippet.title) : null;
        const uploadsPlaylistId =
          isRecord(contentDetails) && isRecord(contentDetails.relatedPlaylists)
            ? readString(contentDetails.relatedPlaylists.uploads)
            : null;

        if (!id || !title || !uploadsPlaylistId) continue;

        const subscriberCountHidden =
          isRecord(statistics) && statistics.hiddenSubscriberCount === true;

        channels.push({
          youtubeChannelId: id,
          title,
          thumbnailUrl: isRecord(snippet)
            ? readThumbnailUrl(snippet.thumbnails)
            : null,
          subscriberCount: subscriberCountHidden
            ? null
            : isRecord(statistics)
              ? readSubscriberCount(statistics.subscriberCount)
              : null,
          subscriberCountHidden,
          uploadsPlaylistId,
        });
      }
    }

    return channels;
  }

  async function listPlaylistPage(
    playlistId: string,
    pageToken?: string | null,
  ): Promise<YouTubePlaylistPage> {
    const normalizedPlaylistId = playlistId.trim();

    if (!normalizedPlaylistId) {
      throw new YouTubeDataApiError("configuration");
    }

    const payload = await request("playlistItems", {
      part: "contentDetails",
      playlistId: normalizedPlaylistId,
      maxResults: String(maximumIdsPerRequest),
      ...(pageToken ? { pageToken } : {}),
    });

    if (!isRecord(payload) || !Array.isArray(payload.items)) {
      throw new YouTubeDataApiError("invalid_response");
    }

    const videoIds = payload.items.flatMap((item) => {
      if (!isRecord(item) || !isRecord(item.contentDetails)) return [];
      const id = readString(item.contentDetails.videoId);
      return id ? [id] : [];
    });

    return {
      videoIds: uniqueNonBlank(videoIds),
      nextPageToken: readString(payload.nextPageToken),
    };
  }

  async function listVideos(videoIds: readonly string[]) {
    const videos: YouTubeVideo[] = [];

    for (const batch of splitIntoBatches(uniqueNonBlank(videoIds))) {
      if (batch.length === 0) continue;

      const payload = await request("videos", {
        part: "snippet,status",
        id: batch.join(","),
        maxResults: String(maximumIdsPerRequest),
      });

      if (!isRecord(payload) || !Array.isArray(payload.items)) {
        throw new YouTubeDataApiError("invalid_response");
      }

      for (const item of payload.items) {
        if (!isRecord(item) || !isRecord(item.snippet)) continue;

        const id = readString(item.id);
        const channelId = readString(item.snippet.channelId);
        const title = readString(item.snippet.title);
        const publishedAt = readIsoDate(item.snippet.publishedAt);

        if (!id || !channelId || !title || !publishedAt) continue;

        const rawPrivacyStatus = isRecord(item.status)
          ? readString(item.status.privacyStatus)
          : null;
        const privacyStatus =
          rawPrivacyStatus === "public" ||
          rawPrivacyStatus === "unlisted" ||
          rawPrivacyStatus === "private"
            ? rawPrivacyStatus
            : "unknown";
        const description = readString(item.snippet.description);

        videos.push({
          youtubeVideoId: id,
          youtubeChannelId: channelId,
          title,
          descriptionExcerpt: description ? description.slice(0, 1000) : null,
          thumbnailUrl: readThumbnailUrl(item.snippet.thumbnails),
          publishedAt,
          privacyStatus,
        });
      }
    }

    return videos;
  }

  return {
    listChannels,
    listPlaylistPage,
    listVideos,
    getRequestCount: () => requestCount,
  };
}

export type YouTubeDataApiClient = ReturnType<
  typeof createYouTubeDataApiClient
>;
