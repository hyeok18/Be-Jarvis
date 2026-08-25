import { describe, expect, it, vi } from "vitest";

import {
  AbuseGuardServiceError,
  createSupabaseAbuseGuardDependencies,
  hashVercelNetwork,
} from "../src/server/abuse/abuse-guard-api";

const userId = "10000000-0000-4000-8000-000000000001";
const restaurantId = "20000000-0000-4000-8000-000000000001";

describe("WU-11 server network HMAC", () => {
  const environment = {
    VERCEL: "1",
    RATE_LIMIT_NETWORK_SALT: "server-only-test-salt",
  };

  it("creates a daily non-reversible network digest without exposing the address", () => {
    const request = new Request("https://example.test/api/reactions", {
      headers: { "x-vercel-forwarded-for": "203.0.113.18" },
    });

    const digest = hashVercelNetwork(
      request,
      environment,
      new Date("2026-08-25T12:00:00.000Z"),
    );
    const nextDayDigest = hashVercelNetwork(
      request,
      environment,
      new Date("2026-08-26T12:00:00.000Z"),
    );

    expect(digest).toMatch(/^[0-9a-f]{64}$/u);
    expect(digest).not.toContain("203.0.113.18");
    expect(nextDayDigest).not.toBe(digest);
  });

  it("rejects local or malformed forwarded values instead of trusting browser headers", () => {
    const request = new Request("http://localhost/api/reactions", {
      headers: { "x-vercel-forwarded-for": "203.0.113.18, 198.51.100.5" },
    });

    expect(() =>
      hashVercelNetwork(request, environment, new Date("2026-08-25T12:00:00.000Z")),
    ).toThrow(AbuseGuardServiceError);
    expect(() =>
      hashVercelNetwork(request, { ...environment, VERCEL: "0" }),
    ).toThrow("configuration");
  });
});
describe("Supabase abuse guard transport", () => {
  const environment = {
    NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_server-only-test",
  };

  it("sends only the HMAC network value to the server-only RPC", async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json([
          {
            is_allowed: true,
            retry_after_seconds: 0,
            risk_codes: ["REACTION_BURST"],
            config_version: "p0-wu11-v1",
          },
        ]);
      },
    );
    const dependencies = createSupabaseAbuseGuardDependencies(
      environment,
      fetchImplementation,
    );
    const networkHash = "a".repeat(64);

    await expect(
      dependencies.enforce({
        userId,
        restaurantId,
        action: "reaction",
        networkHash,
      }),
    ).resolves.toEqual({
      isAllowed: true,
      retryAfterSeconds: 0,
      riskCodes: ["REACTION_BURST"],
    });

    const [url, init] = fetchImplementation.mock.calls[0];
    expect(String(url)).toBe(
      "https://project-ref.supabase.co/rest/v1/rpc/enforce_reaction_abuse_guard",
    );
    expect(init?.headers).toEqual({
      Accept: "application/json",
      apikey: "sb_secret_server-only-test",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      p_user_id: userId,
      p_restaurant_id: restaurantId,
      p_action: "reaction",
      p_network_hash: networkHash,
    });
    expect(String(init?.body)).not.toContain("203.0.113.18");
  });

  it("fails closed for malformed decisions and unknown restaurants", async () => {
    const malformed = createSupabaseAbuseGuardDependencies(
      environment,
      vi.fn(async () =>
        Response.json([
          {
            is_allowed: false,
            retry_after_seconds: 0,
            risk_codes: [],
            config_version: "p0-wu11-v1",
          },
        ]),
      ),
    );

    await expect(
      malformed.enforce({
        userId,
        restaurantId,
        action: "reaction",
        networkHash: "a".repeat(64),
      }),
    ).rejects.toThrow("unavailable");

    const missingRestaurant = createSupabaseAbuseGuardDependencies(
      environment,
      vi.fn(async () =>
        Response.json(
          { code: "23503", details: "private database detail" },
          { status: 400 },
        ),
      ),
    );

    await expect(
      missingRestaurant.enforce({
        userId,
        restaurantId,
        action: "checkin",
        networkHash: "a".repeat(64),
      }),
    ).rejects.toThrow("not_found");
  });
});
