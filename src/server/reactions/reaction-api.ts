import {
  digestVisitProofToken,
  isVisitProofToken,
} from "../visits/visit-proof-token";
import {
  AbuseGuardServiceError,
  type AbuseGuardDecision,
} from "../abuse/abuse-guard-api";

const reactionKinds = ["like", "okay", "dislike"] as const;

export type ReactionKind = (typeof reactionKinds)[number];

export type SavedReaction = {
  reactionId: string;
  kind: ReactionKind;
  moderationStatus: "private_only" | "counted" | "held" | "rejected";
  wasCreated: boolean;
  wasChanged: boolean;
  savedAt: string;
};

type SaveReactionInput = {
  userId: string;
  restaurantId: string;
  kind: ReactionKind;
  visitProofDigest?: string;
};

export type ReactionApiDependencies = {
  verifyAccessToken: (accessToken: string) => Promise<{ id: string } | null>;
  assessAbuse?: (input: {
    userId: string;
    restaurantId: string;
    action: "reaction";
    request: Request;
  }) => Promise<AbuseGuardDecision>;
  saveReaction: (input: SaveReactionInput) => Promise<SavedReaction>;
};

type SupabaseEnvironment = Readonly<Record<string, string | undefined>>;

type SupabaseEnvironmentKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  | "SUPABASE_SECRET_KEY";

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SupabaseReactionRow = {
  reaction_id: unknown;
  reaction_kind: unknown;
  moderation_status: unknown;
  was_created: unknown;
  was_changed: unknown;
  saved_at: unknown;
};

class ReactionServiceError extends Error {
  constructor(
    readonly kind:
      | "configuration"
      | "unavailable"
      | "not_found"
      | "visit_proof_invalid",
  ) {
    super(kind);
    this.name = "ReactionServiceError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isReactionKind(value: unknown): value is ReactionKind {
  return reactionKinds.some((kind) => kind === value);
}

function isModerationStatus(
  value: unknown,
): value is SavedReaction["moderationStatus"] {
  return (
    value === "private_only" ||
    value === "counted" ||
    value === "held" ||
    value === "rejected"
  );
}

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
) {
  return jsonResponse({ error: { code, message } }, status);
}

function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
      },
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

async function readReactionInput(request: Request) {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);

  if (
    (keys.length !== 2 && keys.length !== 3) ||
    !keys.includes("restaurantId") ||
    !keys.includes("kind") ||
    !isUuid(record.restaurantId) ||
    !isReactionKind(record.kind) ||
    (keys.length === 3 &&
      (!keys.includes("visitProofToken") ||
        !isVisitProofToken(record.visitProofToken)))
  ) {
    return null;
  }

  return {
    restaurantId: record.restaurantId,
    kind: record.kind,
    visitProofToken:
      typeof record.visitProofToken === "string"
        ? record.visitProofToken
        : undefined,
  };
}

export function createReactionPostHandler(dependencies: ReactionApiDependencies) {
  return async function POST(request: Request) {
    const accessToken = readBearerToken(request);

    if (!accessToken) {
      return errorResponse(
        401,
        "AUTH_REQUIRED",
        "로그인 후 반응을 남길 수 있습니다.",
      );
    }

    let user: { id: string } | null;

    try {
      user = await dependencies.verifyAccessToken(accessToken);
    } catch {
      return errorResponse(
        503,
        "AUTH_UNAVAILABLE",
        "인증 서비스를 잠시 사용할 수 없습니다.",
      );
    }

    if (!user || !isUuid(user.id)) {
      return errorResponse(
        401,
        "INVALID_TOKEN",
        "로그인 정보가 유효하지 않습니다.",
      );
    }

    const input = await readReactionInput(request);

    if (!input) {
      return errorResponse(
        400,
        "INVALID_REQUEST",
        "restaurantId와 유효한 반응을 확인해 주세요.",
      );
    }

    if (dependencies.assessAbuse) {
      let abuseDecision: AbuseGuardDecision;

      try {
        abuseDecision = await dependencies.assessAbuse({
          userId: user.id,
          restaurantId: input.restaurantId,
          action: "reaction",
          request,
        });
      } catch (error) {
        if (error instanceof AbuseGuardServiceError && error.kind === "not_found") {
          return errorResponse(
            404,
            "RESTAURANT_NOT_FOUND",
            "반응을 남길 수 있는 식당을 찾지 못했습니다.",
          );
        }

        return errorResponse(
          503,
          "ABUSE_GUARD_UNAVAILABLE",
          "요청을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }

      if (!abuseDecision.isAllowed) {
        return rateLimitResponse(abuseDecision.retryAfterSeconds);
      }
    }

    try {
      const reaction = await dependencies.saveReaction({
        userId: user.id,
        restaurantId: input.restaurantId,
        kind: input.kind,
        ...(input.visitProofToken
          ? { visitProofDigest: digestVisitProofToken(input.visitProofToken) }
          : {}),
      });

      return jsonResponse({ reaction }, reaction.wasCreated ? 201 : 200);
    } catch (error) {
      if (error instanceof ReactionServiceError && error.kind === "not_found") {
        return errorResponse(
          404,
          "RESTAURANT_NOT_FOUND",
          "반응을 남길 수 있는 식당을 찾지 못했습니다.",
        );
      }

      if (
        error instanceof ReactionServiceError &&
        error.kind === "configuration"
      ) {
        return errorResponse(
          503,
          "SERVICE_NOT_CONFIGURED",
          "반응 저장 서비스가 아직 설정되지 않았습니다.",
        );
      }

      if (
        error instanceof ReactionServiceError &&
        error.kind === "visit_proof_invalid"
      ) {
        return errorResponse(
          409,
          "VISIT_PROOF_INVALID",
          "방문 확인이 만료됐거나 이미 사용됐습니다. 다시 체크인해 주세요.",
        );
      }

      return errorResponse(
        503,
        "REACTION_SAVE_UNAVAILABLE",
        "반응을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  };
}

function requireEnvironmentValue(
  environment: SupabaseEnvironment,
  key: SupabaseEnvironmentKey,
) {
  const value = environment[key]?.trim();

  if (!value) {
    throw new ReactionServiceError("configuration");
  }

  return value;
}

function createSupabaseUrl(baseUrl: string, path: string) {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ReactionServiceError("configuration");
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new ReactionServiceError("configuration");
  }

  parsed.pathname = path;
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ReactionServiceError("unavailable");
  }
}

function parseSavedReaction(value: unknown): SavedReaction {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    throw new ReactionServiceError("unavailable");
  }

  const candidate = row as SupabaseReactionRow;

  if (
    !isUuid(candidate.reaction_id) ||
    !isReactionKind(candidate.reaction_kind) ||
    !isModerationStatus(candidate.moderation_status) ||
    typeof candidate.was_created !== "boolean" ||
    typeof candidate.was_changed !== "boolean" ||
    typeof candidate.saved_at !== "string" ||
    Number.isNaN(Date.parse(candidate.saved_at))
  ) {
    throw new ReactionServiceError("unavailable");
  }

  return {
    reactionId: candidate.reaction_id,
    kind: candidate.reaction_kind,
    moderationStatus: candidate.moderation_status,
    wasCreated: candidate.was_created,
    wasChanged: candidate.was_changed,
    savedAt: candidate.saved_at,
  };
}

export function createSupabaseReactionDependencies(
  environment: SupabaseEnvironment,
  fetchImplementation: Fetch = fetch,
): ReactionApiDependencies {
  return {
    async verifyAccessToken(accessToken) {
      const baseUrl = requireEnvironmentValue(
        environment,
        "NEXT_PUBLIC_SUPABASE_URL",
      );
      const publishableKey = requireEnvironmentValue(
        environment,
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      );
      const response = await fetchImplementation(
        createSupabaseUrl(baseUrl, "/auth/v1/user"),
        {
          method: "GET",
          headers: {
            apikey: publishableKey,
            authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        },
      );

      if (response.status === 401 || response.status === 403) {
        return null;
      }

      if (!response.ok) {
        throw new ReactionServiceError("unavailable");
      }

      const value = await safeJson(response);

      if (!value || typeof value !== "object" || !isUuid((value as { id?: unknown }).id)) {
        throw new ReactionServiceError("unavailable");
      }

      return { id: (value as { id: string }).id };
    },

    async saveReaction(input) {
      const baseUrl = requireEnvironmentValue(
        environment,
        "NEXT_PUBLIC_SUPABASE_URL",
      );
      const secretKey = requireEnvironmentValue(environment, "SUPABASE_SECRET_KEY");
      const usesVisitProof = Boolean(input.visitProofDigest);
      const response = await fetchImplementation(
        createSupabaseUrl(
          baseUrl,
          usesVisitProof
            ? "/rest/v1/rpc/save_reaction_with_visit_proof"
            : "/rest/v1/rpc/save_reaction_selection",
        ),
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            apikey: secretKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            usesVisitProof
              ? {
                  p_user_id: input.userId,
                  p_restaurant_id: input.restaurantId,
                  p_kind: input.kind,
                  p_evidence_digest: input.visitProofDigest,
                }
              : {
                  p_user_id: input.userId,
                  p_restaurant_id: input.restaurantId,
                  p_kind: input.kind,
                },
          ),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const errorBody = await safeJson(response);
        const errorCode =
          errorBody && typeof errorBody === "object"
            ? (errorBody as { code?: unknown }).code
            : null;

        if (errorCode === "23503") {
          throw new ReactionServiceError("not_found");
        }

        const errorMessage =
          errorBody && typeof errorBody === "object"
            ? (errorBody as { message?: unknown }).message
            : null;

        if (
          errorCode === "23514" &&
          typeof errorMessage === "string" &&
          [
            "MISSING_VISIT_PROOF",
            "VISIT_PROOF_MISMATCH",
            "VISIT_PROOF_NOT_VERIFIED",
            "VISIT_PROOF_EXPIRED",
            "DUPLICATE_PROOF",
          ].includes(errorMessage)
        ) {
          throw new ReactionServiceError("visit_proof_invalid");
        }

        throw new ReactionServiceError("unavailable");
      }

      return parseSavedReaction(await safeJson(response));
    },
  };
}
