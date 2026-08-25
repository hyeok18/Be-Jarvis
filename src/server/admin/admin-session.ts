import {
  AdminAuthError,
  type AdminAuthDependencies,
  type AdminUser,
} from "./admin-auth";

export const ADMIN_SESSION_COOKIE = "be_jarvis_admin_session";

const maximumSessionSeconds = 60 * 60;

function jsonResponse(body: unknown, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...headers,
    },
  });
}

function errorResponse(status: number, code: string, message: string) {
  return jsonResponse({ error: { code, message } }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isSafePassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 1024;
}

async function readCredentials(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let value: unknown;

  try {
    if (contentType.includes("application/json")) {
      value = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      value = { email: form.get("email"), password: form.get("password") };
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  const keys = Object.keys(value);

  if (
    keys.length !== 2 ||
    !keys.includes("email") ||
    !keys.includes("password") ||
    !isSafeEmail(value.email) ||
    !isSafePassword(value.password)
  ) {
    return null;
  }

  return { email: value.email.trim(), password: value.password };
}

function serializeSessionCookie(
  accessToken: string,
  maxAge: number,
  secure: boolean,
) {
  return [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(accessToken)}`,
    "Path=/",
    `Max-Age=${Math.min(maxAge, maximumSessionSeconds)}`,
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

function clearSessionCookie(secure: boolean) {
  return [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

function usesSecureCookie(request: Request) {
  return new URL(request.url).protocol === "https:";
}

export function readAdminSessionToken(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const item of cookieHeader.split(";")) {
    const [name, ...valueParts] = item.trim().split("=");
    if (name !== ADMIN_SESSION_COOKIE) continue;

    const encodedValue = valueParts.join("=");
    if (!encodedValue) return null;

    try {
      return decodeURIComponent(encodedValue);
    } catch {
      return null;
    }
  }

  return null;
}

export async function requireAdminUser(
  request: Request,
  dependencies: Pick<AdminAuthDependencies, "verifyAdminAccessToken">,
): Promise<AdminUser | null> {
  const accessToken = readAdminSessionToken(request);
  if (!accessToken) return null;
  return dependencies.verifyAdminAccessToken(accessToken);
}

export function createAdminSessionPostHandler(
  dependencies: Pick<AdminAuthDependencies, "signInWithPassword">,
) {
  return async function POST(request: Request) {
    const credentials = await readCredentials(request);

    if (!credentials) {
      return errorResponse(
        400,
        "INVALID_REQUEST",
        "이메일과 비밀번호를 확인해 주세요.",
      );
    }

    try {
      const session = await dependencies.signInWithPassword(
        credentials.email,
        credentials.password,
      );

      return jsonResponse(
        { user: session.user },
        200,
        {
          "Set-Cookie": serializeSessionCookie(
            session.accessToken,
            session.expiresIn,
            usesSecureCookie(request),
          ),
        },
      );
    } catch (error) {
      if (error instanceof AdminAuthError) {
        if (error.kind === "invalid_credentials") {
          return errorResponse(
            401,
            "INVALID_CREDENTIALS",
            "이메일 또는 비밀번호가 올바르지 않습니다.",
          );
        }

        if (error.kind === "forbidden") {
          return errorResponse(
            403,
            "ADMIN_REQUIRED",
            "관리자 권한이 있는 계정만 접근할 수 있습니다.",
          );
        }

        if (error.kind === "configuration") {
          return errorResponse(
            503,
            "SERVICE_NOT_CONFIGURED",
            "관리자 로그인이 아직 설정되지 않았습니다.",
          );
        }
      }

      return errorResponse(
        503,
        "AUTH_UNAVAILABLE",
        "로그인 서비스를 잠시 사용할 수 없습니다.",
      );
    }
  };
}

export function createAdminSessionDeleteHandler() {
  return async function DELETE(request: Request) {
    return jsonResponse(
      { signedOut: true },
      200,
      { "Set-Cookie": clearSessionCookie(usesSecureCookie(request)) },
    );
  };
}
