import {
  createVisitProofToken,
  digestVisitProofToken,
} from "./visit-proof-token";
import {
  AbuseGuardServiceError,
  type AbuseGuardDecision,
} from "../abuse/abuse-guard-api";

const failureReasonCodes = [
  "INVALID_LOCATION",
  "ACCURACY_INSUFFICIENT",
  "OUT_OF_RANGE",
] as const;

type FailureReasonCode = (typeof failureReasonCodes)[number];

export type IssuedLocationProof = Readonly<{
  proofId: string;
  isValid: boolean;
  reasonCode: FailureReasonCode | null;
  expiresAt: string | null;
}>;

type IssueLocationProofInput = Readonly<{
  userId: string;
  restaurantId: string;
  evidenceDigest: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}>;

export type VisitProofApiDependencies = Readonly<{
  verifyAccessToken: (accessToken: string) => Promise<{ id: string } | null>;
  assessAbuse?: (input: {
    userId: string;
    restaurantId: string;
    action: "checkin";
    request: Request;
  }) => Promise<AbuseGuardDecision>;
  issueLocationProof: (
    input: IssueLocationProofInput,
  ) => Promise<IssuedLocationProof>;
  createProofToken?: () => string;
}>;

type SupabaseEnvironment = Readonly<Record<string, string | undefined>>;

type SupabaseEnvironmentKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_SECRET_KEY";

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SupabaseVisitProofRow = {
  visit_proof_id: unknown;
  is_valid: unknown;
  reason_code: unknown;
  expires_at: unknown;
};

class VisitProofServiceError extends Error {
  constructor(
    readonly kind: "configuration" | "unavailable" | "not_found",
  ) {
    super(kind);
    this.name = "VisitProofServiceError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFailureReasonCode(value: unknown): value is FailureReasonCode {
  return failureReasonCodes.some((reason) => reason === value);
}

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function errorResponse(status: number, code: string, message: string) {
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
  const match = authorization
    ? /^Bearer\s+(\S+)$/i.exec(authorization.trim())
    : null;

  return match?.[1] ?? null;
}

async function readLocationInput(request: Request) {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);

  if (
    keys.length !== 4 ||
    !keys.includes("restaurantId") ||
    !keys.includes("latitude") ||
    !keys.includes("longitude") ||
    !keys.includes("accuracyMeters") ||
    !isUuid(record.restaurantId) ||
    !isFiniteNumber(record.latitude) ||
    record.latitude < -90 ||
    record.latitude > 90 ||
    !isFiniteNumber(record.longitude) ||
    record.longitude < -180 ||
    record.longitude > 180 ||
    !isFiniteNumber(record.accuracyMeters) ||
    record.accuracyMeters < 0
  ) {
    return null;
  }

  return {
    restaurantId: record.restaurantId,
    latitude: record.latitude,
    longitude: record.longitude,
    accuracyMeters: record.accuracyMeters,
  };
}

function checkInFailureCopy(reasonCode: FailureReasonCode) {
  if (reasonCode === "ACCURACY_INSUFFICIENT") {
    return "현재 위치의 정확도가 부족해요. 잠시 후 다시 시도해 주세요.";
  }

  if (reasonCode === "OUT_OF_RANGE") {
    return "식당 근처에서 다시 체크인해 주세요.";
  }

  return "현재 위치를 확인하지 못했어요. 위치 설정을 확인해 주세요.";
}

export function createVisitCheckInPostHandler(
  dependencies: VisitProofApiDependencies,
) {
  return async function POST(request: Request) {
    const accessToken = readBearerToken(request);

    if (!accessToken) {
      return errorResponse(
        401,
        "AUTH_REQUIRED",
        "로그인 후 방문 체크인을 할 수 있습니다.",
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

    const input = await readLocationInput(request);

    if (!input) {
      return errorResponse(
        400,
        "INVALID_LOCATION_REQUEST",
        "식당과 현재 위치 정보를 확인해 주세요.",
      );
    }

    if (dependencies.assessAbuse) {
      let abuseDecision: AbuseGuardDecision;

      try {
        abuseDecision = await dependencies.assessAbuse({
          userId: user.id,
          restaurantId: input.restaurantId,
          action: "checkin",
          request,
        });
      } catch (error) {
        if (error instanceof AbuseGuardServiceError && error.kind === "not_found") {
          return errorResponse(
            404,
            "RESTAURANT_NOT_FOUND",
            "체크인할 수 있는 식당을 찾지 못했습니다.",
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

    const proofToken = (dependencies.createProofToken ?? createVisitProofToken)();
    const evidenceDigest = digestVisitProofToken(proofToken);

    try {
      const proof = await dependencies.issueLocationProof({
        userId: user.id,
        restaurantId: input.restaurantId,
        evidenceDigest,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
      });

      if (!proof.isValid) {
        const reasonCode = proof.reasonCode ?? "INVALID_LOCATION";
        return errorResponse(422, reasonCode, checkInFailureCopy(reasonCode));
      }

      if (!proof.expiresAt) {
        return errorResponse(
          503,
          "VISIT_PROOF_UNAVAILABLE",
          "방문 확인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }

      return jsonResponse(
        {
          visitProof: {
            token: proofToken,
            method: "location_checkin",
            expiresAt: proof.expiresAt,
          },
        },
        201,
      );
    } catch (error) {
      if (error instanceof VisitProofServiceError && error.kind === "not_found") {
        return errorResponse(
          404,
          "RESTAURANT_NOT_FOUND",
          "체크인할 수 있는 식당을 찾지 못했습니다.",
        );
      }

      if (
        error instanceof VisitProofServiceError &&
        error.kind === "configuration"
      ) {
        return errorResponse(
          503,
          "SERVICE_NOT_CONFIGURED",
          "방문 확인 서비스가 아직 설정되지 않았습니다.",
        );
      }

      return errorResponse(
        503,
        "VISIT_PROOF_UNAVAILABLE",
        "방문 확인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  };
}

function requireEnvironmentValue(
  environment: SupabaseEnvironment,
  key: SupabaseEnvironmentKey,
) {
  const value = environment[key]?.trim();
  if (!value) throw new VisitProofServiceError("configuration");
  return value;
}

function createSupabaseUrl(baseUrl: string, path: string) {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new VisitProofServiceError("configuration");
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new VisitProofServiceError("configuration");
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
    throw new VisitProofServiceError("unavailable");
  }
}

function parseIssuedProof(value: unknown): IssuedLocationProof {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") {
    throw new VisitProofServiceError("unavailable");
  }

  const candidate = row as SupabaseVisitProofRow;
  const validExpiry =
    candidate.expires_at === null ||
    (typeof candidate.expires_at === "string" &&
      !Number.isNaN(Date.parse(candidate.expires_at)));

  if (
    !isUuid(candidate.visit_proof_id) ||
    typeof candidate.is_valid !== "boolean" ||
    (candidate.reason_code !== null &&
      !isFailureReasonCode(candidate.reason_code)) ||
    !validExpiry ||
    (candidate.is_valid &&
      (candidate.reason_code !== null || candidate.expires_at === null)) ||
    (!candidate.is_valid && candidate.reason_code === null)
  ) {
    throw new VisitProofServiceError("unavailable");
  }

  return {
    proofId: candidate.visit_proof_id,
    isValid: candidate.is_valid,
    reasonCode: candidate.reason_code,
    expiresAt: candidate.expires_at as string | null,
  };
}

export function createSupabaseVisitProofDependencies(
  environment: SupabaseEnvironment,
  fetchImplementation: Fetch = fetch,
): Pick<VisitProofApiDependencies, "issueLocationProof"> {
  return {
    async issueLocationProof(input) {
      const baseUrl = requireEnvironmentValue(
        environment,
        "NEXT_PUBLIC_SUPABASE_URL",
      );
      const secretKey = requireEnvironmentValue(environment, "SUPABASE_SECRET_KEY");
      const response = await fetchImplementation(
        createSupabaseUrl(baseUrl, "/rest/v1/rpc/issue_location_visit_proof"),
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            apikey: secretKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_user_id: input.userId,
            p_restaurant_id: input.restaurantId,
            p_evidence_digest: input.evidenceDigest,
            p_user_latitude: input.latitude,
            p_user_longitude: input.longitude,
            p_accuracy_meters: input.accuracyMeters,
          }),
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
          throw new VisitProofServiceError("not_found");
        }

        throw new VisitProofServiceError("unavailable");
      }

      return parseIssuedProof(await safeJson(response));
    },
  };
}
