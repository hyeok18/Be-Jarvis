type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SupabaseEnvironment = Readonly<Record<string, string | undefined>>;

type AdminMetadata = Readonly<Record<string, unknown>>;

export type AdminUser = {
  id: string;
  email: string | null;
};

export type AdminSession = {
  accessToken: string;
  expiresIn: number;
  user: AdminUser;
};

export type AdminAuthDependencies = {
  signInWithPassword: (email: string, password: string) => Promise<AdminSession>;
  verifyAdminAccessToken: (accessToken: string) => Promise<AdminUser | null>;
};

export class AdminAuthError extends Error {
  constructor(
    readonly kind:
      | "configuration"
      | "invalid_credentials"
      | "forbidden"
      | "unavailable"
      | "invalid_response",
  ) {
    super(kind);
    this.name = "AdminAuthError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireEnvironmentValue(
  environment: SupabaseEnvironment,
  key: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
) {
  const value = environment[key]?.trim();

  if (!value) throw new AdminAuthError("configuration");
  return value;
}

function createAuthUrl(baseUrl: string, path: string) {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    throw new AdminAuthError("configuration");
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new AdminAuthError("configuration");
  }

  url.pathname = `/auth/v1/${path}`;
  url.hash = "";
  return url;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AdminAuthError("invalid_response");
  }
}

/**
 * Authorization must use Supabase app_metadata. user_metadata is deliberately
 * ignored because an authenticated user can edit it themselves.
 */
export function hasAdminAppMetadata(metadata: unknown) {
  if (!isRecord(metadata)) return false;
  return metadata.role === "admin" || metadata.is_admin === true;
}

function parseAdminUser(value: unknown): AdminUser | null {
  if (!isRecord(value) || !uuidPattern.test(String(value.id ?? ""))) {
    throw new AdminAuthError("invalid_response");
  }

  if (!hasAdminAppMetadata(value.app_metadata)) return null;

  return {
    id: String(value.id),
    email: typeof value.email === "string" ? value.email : null,
  };
}

export function createSupabaseAdminAuth(
  environment: SupabaseEnvironment,
  fetchImplementation: Fetch = fetch,
): AdminAuthDependencies {
  const baseUrl = requireEnvironmentValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const publishableKey = requireEnvironmentValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );

  async function verifyAdminAccessToken(accessToken: string) {
    const response = await fetchImplementation(createAuthUrl(baseUrl, "user"), {
      method: "GET",
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new AdminAuthError("unavailable");

    return parseAdminUser(await readJson(response));
  }

  return {
    verifyAdminAccessToken,

    async signInWithPassword(email, password) {
      const tokenUrl = createAuthUrl(baseUrl, "token");
      tokenUrl.searchParams.set("grant_type", "password");

      const response = await fetchImplementation(tokenUrl, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });

      if (response.status === 400 || response.status === 401) {
        throw new AdminAuthError("invalid_credentials");
      }
      if (!response.ok) throw new AdminAuthError("unavailable");

      const value = await readJson(response);
      if (!isRecord(value)) throw new AdminAuthError("invalid_response");

      const accessToken = value.access_token;
      const expiresIn = value.expires_in;
      if (
        typeof accessToken !== "string" ||
        !accessToken ||
        typeof expiresIn !== "number" ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0
      ) {
        throw new AdminAuthError("invalid_response");
      }

      const user = await verifyAdminAccessToken(accessToken);
      if (!user) throw new AdminAuthError("forbidden");

      return {
        accessToken,
        expiresIn: Math.floor(expiresIn),
        user,
      };
    },
  };
}

export type { AdminMetadata };
