import { describe, expect, it } from "vitest";

import { submitAuthenticatedReaction } from "../src/components/restaurant-detail/reaction-submit";
import { resolveBrowserSupabaseConfiguration } from "../src/lib/supabase/browser-client";

const validReaction = {
  reaction: {
    reactionId: "20000000-0000-4000-8000-000000000001",
    kind: "like",
    moderationStatus: "private_only",
    wasCreated: true,
    wasChanged: false,
    savedAt: "2026-08-25T01:00:00.000Z",
  },
};

describe("browser Supabase configuration", () => {
  it("accepts only a public browser key and an allowed URL", () => {
    expect(
      resolveBrowserSupabaseConfiguration({
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_test",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });

    expect(
      resolveBrowserSupabaseConfiguration({
        url: "https://example.supabase.co",
        publishableKey: "sb_secret_must_not_reach_browser",
      }),
    ).toBeNull();
    expect(
      resolveBrowserSupabaseConfiguration({
        url: "http://example.supabase.co",
        publishableKey: "sb_publishable_test",
      }),
    ).toBeNull();
  });
});

describe("authenticated reaction request", () => {
  it("sends the access token only in the authorization header", async () => {
    const requests: Array<{
      input: string | URL | Request;
      init?: RequestInit;
    }> = [];
    const fetchImplementation = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      requests.push({ input, init });
      return Response.json(validReaction, { status: 200 });
    };

    await expect(
      submitAuthenticatedReaction(
        {
          accessToken: "test-access-token",
          restaurantId: "10000000-0000-4000-8000-000000000001",
          kind: "like",
        },
        fetchImplementation,
      ),
    ).resolves.toEqual(validReaction.reaction);

    expect(requests).toHaveLength(1);
    const { input: url, init: request } = requests[0];
    if (!request) throw new Error("reaction request was not captured");
    expect(url).toBe("/api/reactions");
    expect(request.headers).toEqual({
      authorization: "Bearer test-access-token",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(request.body))).toEqual({
      restaurantId: "10000000-0000-4000-8000-000000000001",
      kind: "like",
    });
    expect(String(request.body)).not.toContain("test-access-token");
  });

  it.each([
    [401, "로그인이 만료됐어요"],
    [404, "식당을 찾지 못했어요"],
    [429, "요청이 많아요"],
  ])("returns safe copy for a %i response", async (status, message) => {
    await expect(
      submitAuthenticatedReaction(
        {
          accessToken: "test-access-token",
          restaurantId: "10000000-0000-4000-8000-000000000001",
          kind: "okay",
        },
        async () => Response.json({ error: "sensitive detail" }, { status }),
      ),
    ).rejects.toThrow(message);
  });

  it("normalizes a network failure or invalid success DTO", async () => {
    await expect(
      submitAuthenticatedReaction(
        {
          accessToken: "test-access-token",
          restaurantId: "10000000-0000-4000-8000-000000000001",
          kind: "dislike",
        },
        async () => {
          throw new Error("network internals");
        },
      ),
    ).rejects.toMatchObject({ status: 503 });

    await expect(
      submitAuthenticatedReaction(
        {
          accessToken: "test-access-token",
          restaurantId: "10000000-0000-4000-8000-000000000001",
          kind: "dislike",
        },
        async () => Response.json({ reaction: { kind: "dislike" } }),
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});
