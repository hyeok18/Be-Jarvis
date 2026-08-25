import { createHmac } from "node:crypto";

const abuseActions = ["reaction", "checkin"] as const;
const riskCodes = [
  "RATE_LIMITED",
  "IMPOSSIBLE_TRAVEL",
  "REACTION_BURST",
  "ACCOUNT_CLUSTER",
] as const;

export type AbuseAction = (typeof abuseActions)[number];
export type AbuseRiskCode = (typeof riskCodes)[number];

export type AbuseGuardInput = Readonly<{
  userId: string;
  restaurantId: string;
  action: AbuseAction;
  networkHash: string;
}>;

export type AbuseGuardDecision = Readonly<{
  isAllowed: boolean;
  retryAfterSeconds: number;
  riskCodes: readonly AbuseRiskCode[];
}>;

export type AbuseGuardDependencies = Readonly<{
  enforce: (input: AbuseGuardInput) => Promise<AbuseGuardDecision>;
}>;

type SupabaseEnvironment = Readonly<Record<string, string | undefined>>;

type SupabaseEnvironmentKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_SECRET_KEY"
  | "RATE_LIMIT_NETWORK_SALT";

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SupabaseAbuseGuardRow = {
  is_allowed: unknown;
  retry_after_seconds: unknown;
  risk_codes: unknown;
  config_version: unknown;
};

export class AbuseGuardServiceError extends Error {
  constructor(
    readonly kind: "configuration" | "unavailable" | "not_found",
  ) {
    super(kind);
    this.name = "AbuseGuardServiceError";
  }
}

function isAbuseAction(value: unknown): value is AbuseAction {
  return abuseActions.some((action) => action === value);
}

function isAbuseRiskCode(value: unknown): value is AbuseRiskCode {
  return riskCodes.some((riskCode) => riskCode === value);
}

function requireEnvironmentValue(
  environment: SupabaseEnvironment,
  key: SupabaseEnvironmentKey,
) {
  const value = environment[key]?.trim();

  if (!value) {
    throw new AbuseGuardServiceError("configuration");
  }

  return value;
}

function createSupabaseUrl(baseUrl: string, path: string) {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new AbuseGuardServiceError("configuration");
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new AbuseGuardServiceError("configuration");
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
    throw new AbuseGuardServiceError("unavailable");
  }
}

function parseAbuseGuardDecision(value: unknown): AbuseGuardDecision {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    throw new AbuseGuardServiceError("unavailable");
  }

  const candidate = row as SupabaseAbuseGuardRow;
  const retryAfterSeconds = candidate.retry_after_seconds;
  const candidateRiskCodes = candidate.risk_codes;
  const validRiskCodes =
    Array.isArray(candidateRiskCodes) &&
    candidateRiskCodes.every(isAbuseRiskCode);

  if (
    typeof candidate.is_allowed !== "boolean" ||
    typeof retryAfterSeconds !== "number" ||
    !Number.isInteger(retryAfterSeconds) ||
    retryAfterSeconds < 0 ||
    typeof candidate.config_version !== "string" ||
    !validRiskCodes ||
    (candidate.is_allowed && retryAfterSeconds !== 0) ||
    (!candidate.is_allowed &&
      (!candidateRiskCodes.includes("RATE_LIMITED") ||
        retryAfterSeconds < 1))
  ) {
    throw new AbuseGuardServiceError("unavailable");
  }

  return {
    isAllowed: candidate.is_allowed,
    retryAfterSeconds,
    riskCodes: candidateRiskCodes,
  };
}

/**
 * Vercel owns x-vercel-forwarded-for. This function only runs when Vercel
 * identifies the server runtime, and turns the raw address into an HMAC before
 * anything leaves process memory. Local tests must inject a guard dependency.
 */
export function hashVercelNetwork(
  request: Request,
  environment: SupabaseEnvironment,
  now: Date = new Date(),
) {
  if (environment.VERCEL !== "1") {
    throw new AbuseGuardServiceError("configuration");
  }

  const rawAddress = request.headers.get("x-vercel-forwarded-for")?.trim();

  if (
    !rawAddress ||
    rawAddress.length > 64 ||
    rawAddress.includes(",") ||
    !/^[0-9a-fA-F:.]+$/u.test(rawAddress)
  ) {
    throw new AbuseGuardServiceError("unavailable");
  }

  const dailySalt = requireEnvironmentValue(environment, "RATE_LIMIT_NETWORK_SALT");
  const day = now.toISOString().slice(0, 10);

  return createHmac("sha256", dailySalt)
    .update("v1:" + day + ":" + rawAddress)
    .digest("hex");
}

export function createSupabaseAbuseGuardDependencies(
  environment: SupabaseEnvironment,
  fetchImplementation: Fetch = fetch,
): AbuseGuardDependencies {
  return {
    async enforce(input) {
      if (!isAbuseAction(input.action) || !/^[0-9a-f]{64}$/u.test(input.networkHash)) {
        throw new AbuseGuardServiceError("unavailable");
      }

      const baseUrl = requireEnvironmentValue(
        environment,
        "NEXT_PUBLIC_SUPABASE_URL",
      );
      const secretKey = requireEnvironmentValue(environment, "SUPABASE_SECRET_KEY");
      const response = await fetchImplementation(
        createSupabaseUrl(baseUrl, "/rest/v1/rpc/enforce_reaction_abuse_guard"),
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
            p_action: input.action,
            p_network_hash: input.networkHash,
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
          throw new AbuseGuardServiceError("not_found");
        }

        throw new AbuseGuardServiceError("unavailable");
      }

      return parseAbuseGuardDecision(await safeJson(response));
    },
  };
}
