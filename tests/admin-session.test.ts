import { describe, expect, it, vi } from "vitest";

import { AdminAuthError } from "../src/server/admin/admin-auth";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionDeleteHandler,
  createAdminSessionPostHandler,
  readAdminSessionToken,
} from "../src/server/admin/admin-session";

const user = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "admin@example.com",
};

function createLoginRequest(body: unknown, url = "https://example.com/api/admin/session") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin session API", () => {
  it("sets a short-lived HttpOnly strict cookie without returning the token", async () => {
    const signInWithPassword = vi.fn(async () => ({
      accessToken: "sensitive-access-token",
      expiresIn: 7200,
      user,
    }));
    const response = await createAdminSessionPostHandler({ signInWithPassword })(
      createLoginRequest({
        email: "admin@example.com",
        password: "correct-password",
      }),
    );
    const body = await response.json();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body).toEqual({ user });
    expect(JSON.stringify(body)).not.toContain("sensitive-access-token");
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=sensitive-access-token`);
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
  });

  it("rejects extra fields and weak input before calling Supabase", async () => {
    const signInWithPassword = vi.fn();
    const handler = createAdminSessionPostHandler({ signInWithPassword });

    for (const body of [
      { email: "invalid", password: "correct-password" },
      { email: "admin@example.com", password: "short" },
      { email: "admin@example.com", password: "correct-password", role: "admin" },
    ]) {
      const response = await handler(createLoginRequest(body));
      expect(response.status).toBe(400);
    }

    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns safe errors for credentials, authorization, and outages", async () => {
    const cases = [
      ["invalid_credentials", 401, "INVALID_CREDENTIALS"],
      ["forbidden", 403, "ADMIN_REQUIRED"],
      ["configuration", 503, "SERVICE_NOT_CONFIGURED"],
      ["unavailable", 503, "AUTH_UNAVAILABLE"],
    ] as const;

    for (const [kind, status, code] of cases) {
      const handler = createAdminSessionPostHandler({
        signInWithPassword: vi.fn(async () => {
          throw new AdminAuthError(kind);
        }),
      });
      const response = await handler(
        createLoginRequest({
          email: "admin@example.com",
          password: "correct-password",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(status);
      expect(body).toMatchObject({ error: { code } });
      expect(JSON.stringify(body)).not.toContain("correct-password");
    }
  });

  it("reads the exact session cookie and clears it on logout", async () => {
    const request = new Request("https://example.com/admin", {
      headers: {
        cookie: `other=value; ${ADMIN_SESSION_COOKIE}=admin%3Dtoken`,
      },
    });
    expect(readAdminSessionToken(request)).toBe("admin=token");

    const response = await createAdminSessionDeleteHandler()(
      new Request("https://example.com/api/admin/session", { method: "DELETE" }),
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=`);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
  });
});
