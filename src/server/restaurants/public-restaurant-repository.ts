import type {
  PublicCreatorEvidenceDto,
  PublicLocalMatchProfileDto,
  PublicReactionSummaryDto,
  PublicRestaurantDto,
  PublicSubscriberCountState,
} from "../../contracts/public-restaurants";
import { DEFAULT_ALGORITHM_CONFIG } from "../../domain/algorithm-config";

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SupabaseEnvironment = Readonly<Record<string, string | undefined>>;

type RepositoryOptions = {
  fetch?: Fetch;
  now?: () => Date;
  timeoutMs?: number;
};

type RestaurantRow = {
  id: string;
  kakaoPlaceId: string;
  name: string;
  categoryName: string;
  address: string;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  foodTags: readonly string[];
  localMatchProfile: PublicLocalMatchProfileDto;
  updatedAt: string;
};

type SummaryRow = {
  restaurantId: string;
  likeCount: number;
  okayCount: number;
  dislikeCount: number;
  countedTotal: number;
  version: number;
  updatedAt: string;
};

type EvidenceRow = {
  id: string;
  creatorVideoId: string;
  restaurantId: string;
  videoTimestampSeconds: number | null;
  confirmedAt: string;
  lastVerifiedAt: string;
};

type VideoRow = {
  id: string;
  youtubeVideoId: string;
  creatorChannelId: string;
  title: string;
  publishedAt: string;
  metadataFetchedAt: string;
};

type ChannelRow = {
  id: string;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  subscriberCountHidden: boolean;
  subscriberCountFetchedAt: string | null;
  metadataFetchedAt: string;
};

export interface PublicRestaurantRepository {
  list(): Promise<readonly PublicRestaurantDto[]>;
  getById(restaurantId: string): Promise<PublicRestaurantDto | null>;
}

export class PublicRestaurantRepositoryError extends Error {
  constructor(
    readonly kind:
      | "configuration"
      | "timeout"
      | "unavailable"
      | "invalid_response",
    readonly httpStatus: number | null = null,
  ) {
    super(kind);
    this.name = "PublicRestaurantRepositoryError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNullableString(value: unknown) {
  if (value === null) return null;
  return readString(value) ?? undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNonNegativeInteger(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function readIsoDateTime(value: unknown) {
  const text = readString(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function requireEnvironmentValue(
  environment: SupabaseEnvironment,
  key: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SECRET_KEY",
) {
  const value = environment[key]?.trim();
  if (!value) throw new PublicRestaurantRepositoryError("configuration");
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
    throw new PublicRestaurantRepositoryError("configuration");
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new PublicRestaurantRepositoryError("configuration");
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

function isFresh(value: string, now: Date) {
  const valueMs = Date.parse(value);
  const nowMs = now.getTime();
  const maximumAgeMs =
    DEFAULT_ALGORITHM_CONFIG.creatorEvidence.metadataMaximumAgeDays *
    24 *
    60 *
    60 *
    1_000;

  return valueMs <= nowMs && nowMs - valueMs <= maximumAgeMs;
}

function parseLocalMatchProfile(
  value: unknown,
  foodTags: readonly string[],
): PublicLocalMatchProfileDto {
  if (!isRecord(value) || !isRecord(value.axisProfile)) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }

  const profileVersion = readString(value.profileVersion);
  const axisProfile = value.axisProfile;
  const axes = [
    "spicy",
    "sweet",
    "light",
    "rich",
    "value",
    "cleanliness",
    "service",
  ] as const;
  const parsedAxes = Object.fromEntries(
    axes.map((axis) => [axis, readFiniteNumber(axisProfile[axis])]),
  ) as Record<(typeof axes)[number], number | null>;

  if (
    !profileVersion ||
    axes.some(
      (axis) => parsedAxes[axis] === null || parsedAxes[axis]! < 0 || parsedAxes[axis]! > 100,
    )
  ) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }

  return {
    profileVersion,
    axisProfile: parsedAxes as PublicLocalMatchProfileDto["axisProfile"],
    foodTags,
  };
}

function parseRestaurant(value: unknown): RestaurantRow {
  if (!isRecord(value)) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }

  const id = readString(value.id);
  const kakaoPlaceId = readString(value.kakao_place_id);
  const name = readString(value.name);
  const categoryName = readString(value.category_name);
  const address = readString(value.address_name);
  const roadAddress = readNullableString(value.road_address_name);
  const latitude = readFiniteNumber(value.latitude);
  const longitude = readFiniteNumber(value.longitude);
  const updatedAt = readIsoDateTime(value.updated_at);
  const foodTags = Array.isArray(value.food_tags)
    ? value.food_tags.filter((tag): tag is string => typeof tag === "string")
    : null;

  if (
    !id ||
    !kakaoPlaceId ||
    !name ||
    !categoryName ||
    !address ||
    roadAddress === undefined ||
    latitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude === null ||
    longitude < -180 ||
    longitude > 180 ||
    !updatedAt ||
    !foodTags
  ) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }

  return {
    id,
    kakaoPlaceId,
    name,
    categoryName,
    address,
    roadAddress,
    latitude,
    longitude,
    foodTags,
    localMatchProfile: parseLocalMatchProfile(value.preference_profile, foodTags),
    updatedAt,
  };
}

function parseSummary(value: unknown): SummaryRow {
  if (!isRecord(value)) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }

  const restaurantId = readString(value.restaurant_id);
  const likeCount = readNonNegativeInteger(value.like_count);
  const okayCount = readNonNegativeInteger(value.okay_count);
  const dislikeCount = readNonNegativeInteger(value.dislike_count);
  const countedTotal = readNonNegativeInteger(value.counted_total);
  const version = readNonNegativeInteger(value.version);
  const updatedAt = readIsoDateTime(value.updated_at);

  if (
    !restaurantId ||
    likeCount === null ||
    okayCount === null ||
    dislikeCount === null ||
    countedTotal === null ||
    version === null ||
    version === 0 ||
    countedTotal !== likeCount + okayCount + dislikeCount ||
    !updatedAt
  ) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }

  return {
    restaurantId,
    likeCount,
    okayCount,
    dislikeCount,
    countedTotal,
    version,
    updatedAt,
  };
}

function parseEvidence(value: unknown, now: Date): EvidenceRow | null {
  if (!isRecord(value)) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }
  if (value.status !== "confirmed") return null;

  const id = readString(value.id);
  const creatorVideoId = readString(value.creator_video_id);
  const restaurantId = readString(value.restaurant_id);
  const videoTimestampSeconds =
    value.video_timestamp_seconds === null
      ? null
      : (readNonNegativeInteger(value.video_timestamp_seconds) ?? undefined);
  const confirmedAt = readIsoDateTime(value.confirmed_at);
  const lastVerifiedAt = readIsoDateTime(value.last_verified_at);

  if (
    !id ||
    !creatorVideoId ||
    !restaurantId ||
    videoTimestampSeconds === undefined ||
    !confirmedAt ||
    !lastVerifiedAt
  ) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }
  if (!isFresh(lastVerifiedAt, now)) return null;

  return {
    id,
    creatorVideoId,
    restaurantId,
    videoTimestampSeconds,
    confirmedAt,
    lastVerifiedAt,
  };
}

function parseVideo(value: unknown, now: Date): VideoRow | null {
  if (!isRecord(value)) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }
  if (value.privacy_status !== "public" || value.is_active !== true) return null;

  const id = readString(value.id);
  const youtubeVideoId = readString(value.youtube_video_id);
  const creatorChannelId = readString(value.creator_channel_id);
  const title = readString(value.title);
  const publishedAt = readIsoDateTime(value.published_at);
  const metadataFetchedAt = readIsoDateTime(value.metadata_fetched_at);

  if (
    !id ||
    !youtubeVideoId ||
    !creatorChannelId ||
    !title ||
    !publishedAt ||
    !metadataFetchedAt
  ) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }
  if (!isFresh(metadataFetchedAt, now)) return null;

  return {
    id,
    youtubeVideoId,
    creatorChannelId,
    title,
    publishedAt,
    metadataFetchedAt,
  };
}

function parseChannel(value: unknown, now: Date): ChannelRow | null {
  if (!isRecord(value)) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }
  if (value.is_allowlisted !== true || value.is_active !== true) return null;

  const id = readString(value.id);
  const youtubeChannelId = readString(value.youtube_channel_id);
  const title = readString(value.title);
  const thumbnailUrl = readNullableString(value.thumbnail_url);
  const subscriberCount =
    value.subscriber_count === null
      ? null
      : (readNonNegativeInteger(value.subscriber_count) ?? undefined);
  const subscriberCountHidden = readBoolean(value.subscriber_count_hidden);
  const subscriberCountFetchedAt =
    value.subscriber_count_fetched_at === null
      ? null
      : (readIsoDateTime(value.subscriber_count_fetched_at) ?? undefined);
  const metadataFetchedAt = readIsoDateTime(value.metadata_fetched_at);

  if (
    !id ||
    !youtubeChannelId ||
    !title ||
    thumbnailUrl === undefined ||
    subscriberCount === undefined ||
    subscriberCountHidden === null ||
    subscriberCountFetchedAt === undefined ||
    !metadataFetchedAt ||
    (subscriberCountHidden && subscriberCount !== null)
  ) {
    throw new PublicRestaurantRepositoryError("invalid_response");
  }
  if (!isFresh(metadataFetchedAt, now)) return null;

  return {
    id,
    youtubeChannelId,
    title,
    thumbnailUrl,
    subscriberCount,
    subscriberCountHidden,
    subscriberCountFetchedAt,
    metadataFetchedAt,
  };
}

function roundPercentage(value: number) {
  const decimals = DEFAULT_ALGORITHM_CONFIG.display.percentageDecimals;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function createReactionSummary(
  restaurantId: string,
  row: SummaryRow | undefined,
): PublicReactionSummaryDto {
  const like = row?.likeCount ?? 0;
  const okay = row?.okayCount ?? 0;
  const dislike = row?.dislikeCount ?? 0;
  const countedTotal = row?.countedTotal ?? 0;
  const percentages =
    countedTotal === 0
      ? null
      : {
          like: roundPercentage((like / countedTotal) * 100),
          okay: roundPercentage((okay / countedTotal) * 100),
          dislike: roundPercentage((dislike / countedTotal) * 100),
        };

  return {
    restaurantId,
    counts: { like, okay, dislike },
    percentages,
    countedTotal,
    isForming:
      countedTotal <
      DEFAULT_ALGORITHM_CONFIG.reactions.minimumCountForEstablishedDistribution,
    version: String(row?.version ?? 0),
    updatedAt: row?.updatedAt ?? null,
  };
}

function subscriberCountState(channel: ChannelRow, now: Date): {
  count: number | null;
  state: PublicSubscriberCountState;
} {
  if (channel.subscriberCountHidden) {
    return { count: null, state: "hidden" };
  }
  if (!channel.subscriberCountFetchedAt) {
    return { count: null, state: "unavailable" };
  }
  if (!isFresh(channel.subscriberCountFetchedAt, now)) {
    return { count: null, state: "stale" };
  }
  if (channel.subscriberCount === null) {
    return { count: null, state: "unavailable" };
  }
  return { count: channel.subscriberCount, state: "known" };
}

function createYouTubeVideoUrl(videoId: string, timestampSeconds: number | null) {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", videoId);
  if (timestampSeconds !== null) {
    url.searchParams.set("t", `${timestampSeconds}s`);
  }
  return url.toString();
}

function createYouTubeChannelUrl(channelId: string) {
  return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
}

function sortCreatorEvidence(
  left: PublicCreatorEvidenceDto,
  right: PublicCreatorEvidenceDto,
) {
  const leftCount = left.channel.subscriberCount;
  const rightCount = right.channel.subscriberCount;
  if (leftCount !== null && rightCount !== null && leftCount !== rightCount) {
    return rightCount - leftCount;
  }
  if (leftCount !== null) return -1;
  if (rightCount !== null) return 1;

  return (
    Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
    left.channel.title.localeCompare(right.channel.title, "ko")
  );
}

export function createPublicRestaurantRepository(
  environment: SupabaseEnvironment,
  options: RepositoryOptions = {},
): PublicRestaurantRepository {
  const fetchImplementation = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function requestRows(
    table: string,
    query: Readonly<Record<string, string>>,
  ) {
    const baseUrl = requireEnvironmentValue(
      environment,
      "NEXT_PUBLIC_SUPABASE_URL",
    );
    const secretKey = requireEnvironmentValue(
      environment,
      "SUPABASE_SECRET_KEY",
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImplementation(createRestUrl(baseUrl, table, query), {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: secretKey,
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new PublicRestaurantRepositoryError("unavailable", response.status);
      }

      let value: unknown;
      try {
        value = await response.json();
      } catch {
        throw new PublicRestaurantRepositoryError(
          "invalid_response",
          response.status,
        );
      }

      if (!Array.isArray(value)) {
        throw new PublicRestaurantRepositoryError(
          "invalid_response",
          response.status,
        );
      }

      return value;
    } catch (error) {
      if (error instanceof PublicRestaurantRepositoryError) throw error;
      if (controller.signal.aborted) {
        throw new PublicRestaurantRepositoryError("timeout");
      }
      throw new PublicRestaurantRepositoryError("unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchRows(restaurantId?: string) {
    const restaurantQuery: Record<string, string> = {
      select:
        "id,kakao_place_id,name,category_name,address_name,road_address_name,latitude,longitude,food_tags,preference_profile,updated_at",
      is_active: "eq.true",
      order: "name.asc,id.asc",
    };
    if (restaurantId) restaurantQuery.id = `eq.${restaurantId}`;

    const restaurants = (
      await requestRows("restaurants", restaurantQuery)
    ).map(parseRestaurant);
    if (restaurants.length === 0) return [];

    const activeRestaurantIds = new Set(restaurants.map((row) => row.id));
    const queryNow = now();
    const cutoff = new Date(
      queryNow.getTime() -
        DEFAULT_ALGORITHM_CONFIG.creatorEvidence.metadataMaximumAgeDays *
          24 *
          60 *
          60 *
          1_000,
    ).toISOString();
    const [summaryValues, evidenceValues] = await Promise.all([
      requestRows("restaurant_reaction_summaries", {
        select:
          "restaurant_id,like_count,okay_count,dislike_count,counted_total,version,updated_at",
        restaurant_id: inFilter([...activeRestaurantIds]),
      }),
      requestRows("creator_visit_evidence", {
        select:
          "id,creator_video_id,restaurant_id,status,video_timestamp_seconds,confirmed_at,last_verified_at",
        restaurant_id: inFilter([...activeRestaurantIds]),
        status: "eq.confirmed",
        last_verified_at: `gte.${cutoff}`,
      }),
    ]);

    const summaryByRestaurantId = new Map(
      summaryValues.map(parseSummary).map((row) => [row.restaurantId, row]),
    );
    if (
      restaurants.some(
        (restaurant) => !summaryByRestaurantId.has(restaurant.id),
      )
    ) {
      throw new PublicRestaurantRepositoryError("invalid_response");
    }
    const evidenceRows = evidenceValues
      .map((value) => parseEvidence(value, queryNow))
      .filter((row): row is EvidenceRow => Boolean(row))
      .filter((row) => activeRestaurantIds.has(row.restaurantId));

    if (evidenceRows.length === 0) {
      return restaurants.map((restaurant) => ({
        id: restaurant.id,
        kakaoPlaceId: restaurant.kakaoPlaceId,
        name: restaurant.name,
        categoryName: restaurant.categoryName,
        address: restaurant.address,
        roadAddress: restaurant.roadAddress,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        updatedAt: restaurant.updatedAt,
        reactionSummary: createReactionSummary(
          restaurant.id,
          summaryByRestaurantId.get(restaurant.id),
        ),
        localMatchProfile: restaurant.localMatchProfile,
        creatorEvidence: [],
      } satisfies PublicRestaurantDto));
    }

    const videoValues = await requestRows("creator_videos", {
      select:
        "id,youtube_video_id,creator_channel_id,title,published_at,privacy_status,metadata_fetched_at,is_active",
      id: inFilter(evidenceRows.map((row) => row.creatorVideoId)),
      privacy_status: "eq.public",
      is_active: "eq.true",
      metadata_fetched_at: `gte.${cutoff}`,
    });
    const videoRows = videoValues
      .map((value) => parseVideo(value, queryNow))
      .filter((row): row is VideoRow => Boolean(row));
    const videoById = new Map(videoRows.map((row) => [row.id, row]));

    const channelValues =
      videoRows.length === 0
        ? []
        : await requestRows("creator_channels", {
            select:
              "id,youtube_channel_id,title,thumbnail_url,subscriber_count,subscriber_count_hidden,subscriber_count_fetched_at,metadata_fetched_at,is_allowlisted,is_active",
            id: inFilter(videoRows.map((row) => row.creatorChannelId)),
            is_allowlisted: "eq.true",
            is_active: "eq.true",
            metadata_fetched_at: `gte.${cutoff}`,
          });
    const channelRows = channelValues
      .map((value) => parseChannel(value, queryNow))
      .filter((row): row is ChannelRow => Boolean(row));
    const channelById = new Map(channelRows.map((row) => [row.id, row]));
    const evidenceByRestaurantId = new Map<string, PublicCreatorEvidenceDto[]>();

    for (const evidence of evidenceRows) {
      const video = videoById.get(evidence.creatorVideoId);
      if (!video) continue;
      const channel = channelById.get(video.creatorChannelId);
      if (!channel) continue;
      const subscriber = subscriberCountState(channel, queryNow);
      const item: PublicCreatorEvidenceDto = {
        evidenceId: evidence.id,
        restaurantId: evidence.restaurantId,
        youtubeVideoId: video.youtubeVideoId,
        videoTitle: video.title,
        videoUrl: createYouTubeVideoUrl(
          video.youtubeVideoId,
          evidence.videoTimestampSeconds,
        ),
        videoTimestampSeconds: evidence.videoTimestampSeconds,
        publishedAt: video.publishedAt,
        videoMetadataFetchedAt: video.metadataFetchedAt,
        lastVerifiedAt: evidence.lastVerifiedAt,
        channel: {
          youtubeChannelId: channel.youtubeChannelId,
          title: channel.title,
          url: createYouTubeChannelUrl(channel.youtubeChannelId),
          thumbnailUrl: channel.thumbnailUrl,
          subscriberCount: subscriber.count,
          subscriberCountState: subscriber.state,
          subscriberCountFetchedAt: channel.subscriberCountFetchedAt,
          metadataFetchedAt: channel.metadataFetchedAt,
        },
      };

      const items = evidenceByRestaurantId.get(evidence.restaurantId) ?? [];
      items.push(item);
      evidenceByRestaurantId.set(evidence.restaurantId, items);
    }

    for (const items of evidenceByRestaurantId.values()) {
      items.sort(sortCreatorEvidence);
    }

    return restaurants.map((restaurant) => ({
      id: restaurant.id,
      kakaoPlaceId: restaurant.kakaoPlaceId,
      name: restaurant.name,
      categoryName: restaurant.categoryName,
      address: restaurant.address,
      roadAddress: restaurant.roadAddress,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      updatedAt: restaurant.updatedAt,
      reactionSummary: createReactionSummary(
        restaurant.id,
        summaryByRestaurantId.get(restaurant.id),
      ),
      localMatchProfile: restaurant.localMatchProfile,
      creatorEvidence: evidenceByRestaurantId.get(restaurant.id) ?? [],
    } satisfies PublicRestaurantDto));
  }

  return {
    list: () => fetchRows(),
    async getById(restaurantId: string) {
      return (await fetchRows(restaurantId))[0] ?? null;
    },
  };
}
