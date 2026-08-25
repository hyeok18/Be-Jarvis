import { describe, expect, it, vi } from "vitest";

import {
  AdminAuthError,
  createSupabaseAdminAuth,
  hasAdminAppMetadata,
} from "../src/server/admin/admin-auth";

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public-test",
};
const userId = "10000000-0000-4000-8000-000000000001";

describe("admin authorization", () => {
  it("accepts only server-controlled app_metadata", () => {
    expect(hasAdminAppMetadata({ role: "admin" })).toBe(true);
    expect(hasAdminAppMetadata({ is_admin: true })).toBe(true);
    expect(hasAdminAppMetadata({ role: "user" })).toBe(false);
    expect(hasAdminAppMetadata(null)).toBe(false);
  });

  it("does not authorize admin-looking user_metadata", async () => {
    const auth = createSupabaseAdminAuth(
      environment,
      vi.fn(async () =>
        Response.json({
          id: userId,
          email: "user@example.com",
          app_metadata: { role: "user" },
          user_metadata: { role: "admin", is_admin: true },
        }),
      ),
    );

    await expect(auth.verifyAdminAccessToken("token")).resolves.toBeNull();
  });

  it("verifies the access token with the publishable key only", async () => {
    const fetchImplementation = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        id: userId,
        email: "admin@example.com",
        app_metadata: { role: "admin" },
      }),
    );
    const auth = createSupabaseAdminAuth(environment, fetchImplementation);

    await expect(auth.verifyAdminAccessToken("admin-token")).resolves.toEqual({
      id: userId,
      email: "admin@example.com",
    });

    const [url, init] = fetchImplementation.mock.calls[0];
    expect(String(url)).toBe("https://project-ref.supabase.co/auth/v1/user");
    expect(init?.headers).toEqual({
      apikey: "sb_publishable_public-test",
      authorization: "Bearer admin-token",
    });
  });

  it("signs in, then independently verifies admin authorization", async () => {
    const fetchImplementation = vi
      .fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json({ access_token: "admin-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: userId,
          email: "admin@example.com",
          app_metadata: { is_admin: true },
        }),
      );
    const auth = createSupabaseAdminAuth(environment, fetchImplementation);

    await expect(
      auth.signInWithPassword("admin@example.com", "correct-password"),
    ).resolves.toEqual({
      accessToken: "admin-token",
      expiresIn: 3600,
      user: { id: userId, email: "admin@example.com" },
    });

    expect(String(fetchImplementation.mock.calls[0][0])).toBe(
      "https://project-ref.supabase.co/auth/v1/token?grant_type=password",
    );
    expect(JSON.parse(String(fetchImplementation.mock.calls[0][1]?.body))).toEqual({
      email: "admin@example.com",
      password: "correct-password",
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("fails closed for invalid credentials and malformed upstream data", async () => {
    const rejected = createSupabaseAdminAuth(
      environment,
      vi.fn(async () => Response.json({ error: "invalid" }, { status: 400 })),
    );
    await expect(
      rejected.signInWithPassword("admin@example.com", "wrong-password"),
    ).rejects.toMatchObject({ kind: "invalid_credentials" });

    const malformed = createSupabaseAdminAuth(
      environment,
      vi.fn(async () => Response.json({ access_token: "token" })),
    );
    await expect(
      malformed.signInWithPassword("admin@example.com", "correct-password"),
    ).rejects.toBeInstanceOf(AdminAuthError);
  });
});
