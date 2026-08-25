type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SupabaseEnvironment = Readonly<Record<string, string | undefined>>;

import type {
  CreatorEvidenceCandidate,
  CreatorEvidenceStatus,
  YouTubeSyncRun,
} from "@/contracts/creator-admin";

export type CreatorAdminRepository = {
  listEvidence: () => Promise<CreatorEvidenceCandidate[]>;
  listSyncRuns: () => Promise<YouTubeSyncRun[]>;
  confirmEvidence: (input: {
    evidenceId: string;
    adminUserId: string;
    confirmationNote: string | null;
    videoTimestampSeconds: number | null;
    decidedAt: string;
  }) => Promise<void>;
  rejectEvidence: (input: {
    evidenceId: string;
    confirmationNote: string | null;
  }) => Promise<void>;
};

export class CreatorAdminRepositoryError extends Error {
  constructor(
    readonly kind:
      | "configuration"
      | "unavailable"
      | "invalid_response"
      | "not_found"
      | "conflict"
      | "not_confirmable",
    readonly httpStatus: number | null = null,
  ) {
    super(kind);
    this.name = "CreatorAdminRepositoryError";
  }
}

const evidenceSelect = [
  "id",
  "status",
  "video_timestamp_seconds",
  "confirmation_note",
  "confirmed_at",
  "last_verified_at",
  "created_at",
  "updated_at",
  "creator_video:creator_videos!creator_visit_evidence_creator_video_id_fkey(id,youtube_video_id,title,published_at,privacy_status,is_active,creator_channel:creator_channels!creator_videos_creator_channel_id_fkey(id,title,youtube_channel_id))",
  "restaurant:restaurants!creator_visit_evidence_restaurant_id_fkey(id,name,address_name,road_address_name,kakao_place_id,is_active)",
].join(",");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRecord(value: unknown) {
  if (!isRecord(value)) throw new CreatorAdminRepositoryError("invalid_response");
  return value;
}

function readString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new CreatorAdminRepositoryError("invalid_response");
  }
  return value;
}

function readNullableString(value: unknown) {
  if (value === null) return null;
  return readString(value);
}

function readNonNegativeInteger(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new CreatorAdminRepositoryError("invalid_response");
  }
  return Number(value);
}

function readNullableNonNegativeInteger(value: unknown) {
  if (value === null) return null;
  return readNonNegativeInteger(value);
}

function isEvidenceStatus(value: unknown): value is CreatorEvidenceStatus {
  return ["candidate", "confirmed", "rejected", "stale"].includes(String(value));
}

function parseEvidence(value: unknown): CreatorEvidenceCandidate {
  const row = readRecord(value);
  const video = readRecord(row.creator_video);
  const channel = readRecord(video.creator_channel);
  const restaurant = readRecord(row.restaurant);
  const status = row.status;
  const youtubeVideoId = readString(video.youtube_video_id);

  if (
    !isEvidenceStatus(status) ||
    typeof video.is_active !== "boolean" ||
    typeof restaurant.is_active !== "boolean"
  ) {
    throw new CreatorAdminRepositoryError("invalid_response");
  }

  return {
    id: readString(row.id),
    status,
    videoTimestampSeconds: readNullableNonNegativeInteger(
      row.video_timestamp_seconds,
    ),
    confirmationNote: readNullableString(row.confirmation_note),
    confirmedAt: readNullableString(row.confirmed_at),
    lastVerifiedAt: readNullableString(row.last_verified_at),
    createdAt: readString(row.created_at),
    updatedAt: readString(row.updated_at),
    video: {
      id: readString(video.id),
      youtubeVideoId,
      title: readString(video.title),
      publishedAt: readString(video.published_at),
      privacyStatus: readString(video.privacy_status),
      isActive: video.is_active,
      originalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}`,
      channel: {
        id: readString(channel.id),
        title: readString(channel.title),
        youtubeChannelId: readString(channel.youtube_channel_id),
      },
    },
    restaurant: {
      id: readString(restaurant.id),
      name: readString(restaurant.name),
      addressName: readString(restaurant.address_name),
      roadAddressName: readNullableString(restaurant.road_address_name),
      kakaoPlaceId: readString(restaurant.kakao_place_id),
      isActive: restaurant.is_active,
    },
  };
}

function isSyncStatus(value: unknown): value is YouTubeSyncRun["status"] {
  return ["queued", "running", "succeeded", "partial", "failed"].includes(
    String(value),
  );
}

function isTriggerKind(value: unknown): value is YouTubeSyncRun["triggerKind"] {
  return value === "manual" || value === "cron";
}

function parseSyncRun(value: unknown): YouTubeSyncRun {
  const row = readRecord(value);

  if (!isSyncStatus(row.status) || !isTriggerKind(row.trigger_kind)) {
    throw new CreatorAdminRepositoryError("invalid_response");
  }

  return {
    id: readString(row.id),
    status: row.status,
    triggerKind: row.trigger_kind,
    apiRequestCount: readNonNegativeInteger(row.api_request_count),
    processedVideoCount: readNonNegativeInteger(row.processed_video_count),
    candidateCount: readNonNegativeInteger(row.candidate_count),
    errorSummary: readNullableString(row.error_summary),
    startedAt: readString(row.started_at),
    finishedAt: readNullableString(row.finished_at),
  };
}

function requireEnvironmentValue(
  environment: SupabaseEnvironment,
  key: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SECRET_KEY",
) {
  const value = environment[key]?.trim();
  if (!value) throw new CreatorAdminRepositoryError("configuration");
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
    throw new CreatorAdminRepositoryError("configuration");
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new CreatorAdminRepositoryError("configuration");
  }

  url.pathname = `/rest/v1/${table}`;
  url.search = "";
  url.hash = "";
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new CreatorAdminRepositoryError("invalid_response", response.status);
  }
}

export function createCreatorAdminRepository(
  environment: SupabaseEnvironment,
  fetchImplementation: Fetch = fetch,
): CreatorAdminRepository {
  const baseUrl = requireEnvironmentValue(environment, "NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnvironmentValue(environment, "SUPABASE_SECRET_KEY");

  async function requestRows(
    table: string,
    init: RequestInit,
    query: Readonly<Record<string, string>> = {},
  ) {
    let response: Response;

    try {
      response = await fetchImplementation(createRestUrl(baseUrl, table, query), {
        ...init,
        headers: {
          Accept: "application/json",
          apikey: secretKey,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        cache: "no-store",
      });
    } catch {
      throw new CreatorAdminRepositoryError("unavailable");
    }

    if (!response.ok) {
      throw new CreatorAdminRepositoryError("unavailable", response.status);
    }

    const value = await readJson(response);
    if (!Array.isArray(value)) {
      throw new CreatorAdminRepositoryError("invalid_response", response.status);
    }
    return value;
  }

  async function getEvidence(evidenceId: string) {
    const rows = await requestRows(
      "creator_visit_evidence",
      { method: "GET" },
      { select: evidenceSelect, id: `eq.${evidenceId}`, limit: "1" },
    );
    if (rows.length === 0) throw new CreatorAdminRepositoryError("not_found");
    return parseEvidence(rows[0]);
  }

  return {
    async listEvidence() {
      const rows = await requestRows(
        "creator_visit_evidence",
        { method: "GET" },
        { select: evidenceSelect, order: "created_at.desc", limit: "100" },
      );
      return rows.map(parseEvidence);
    },

    async listSyncRuns() {
      const rows = await requestRows(
        "youtube_sync_runs",
        { method: "GET" },
        {
          select:
            "id,status,trigger_kind,api_request_count,processed_video_count,candidate_count,error_summary,started_at,finished_at",
          order: "started_at.desc",
          limit: "50",
        },
      );
      return rows.map(parseSyncRun);
    },

    async confirmEvidence(input) {
      const current = await getEvidence(input.evidenceId);
      if (current.status !== "candidate") {
        throw new CreatorAdminRepositoryError("conflict");
      }
      if (
        !current.video.isActive ||
        current.video.privacyStatus !== "public" ||
        !current.restaurant.isActive
      ) {
        throw new CreatorAdminRepositoryError("not_confirmable");
      }

      const rows = await requestRows(
        "creator_visit_evidence",
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: "confirmed",
            confirmed_by: input.adminUserId,
            confirmed_at: input.decidedAt,
            last_verified_at: input.decidedAt,
            confirmation_note: input.confirmationNote,
            video_timestamp_seconds: input.videoTimestampSeconds,
          }),
        },
        {
          id: `eq.${input.evidenceId}`,
          status: "eq.candidate",
          select: "id",
        },
      );
      if (rows.length === 0) throw new CreatorAdminRepositoryError("conflict");
    },

    async rejectEvidence(input) {
      const current = await getEvidence(input.evidenceId);
      if (current.status !== "candidate") {
        throw new CreatorAdminRepositoryError("conflict");
      }

      const rows = await requestRows(
        "creator_visit_evidence",
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: "rejected",
            confirmation_note: input.confirmationNote,
            confirmed_by: null,
            confirmed_at: null,
            last_verified_at: null,
          }),
        },
        {
          id: `eq.${input.evidenceId}`,
          status: "eq.candidate",
          select: "id",
        },
      );
      if (rows.length === 0) throw new CreatorAdminRepositoryError("conflict");
    },
  };
}
