import { describe, expect, it, vi } from "vitest";

import {
  createReactionPostHandler,
  createSupabaseReactionDependencies,
  type ReactionApiDependencies,
  type SavedReaction,
} from "../src/server/reactions/reaction-api";

const userId = "10000000-0000-4000-8000-000000000001";
const restaurantId = "20000000-0000-4000-8000-000000000001";
const reactionId = "30000000-0000-4000-8000-000000000001";

const savedReaction: SavedReaction = {
  reactionId,
  kind: "like",
  moderationStatus: "private_only",
  wasCreated: true,
  wasChanged: true,
  savedAt: "2026-08-25T07:00:00.000Z",
};

function createRequest(
  body: unknown = { restaurantId, kind: "like" },
  authorization = "Bearer user-access-token",
) {
  return new Request("http://localhost/api/reactions", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createDependencies(
  overrides: Partial<ReactionApiDependencies> = {},
): ReactionApiDependencies {
  return {
    verifyAccessToken: vi.fn(async () => ({ id: userId })),
    saveReaction: vi.fn(async () => savedReaction),
    ...overrides,
  };
}

async function readBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("POST /api/reactions", () => {
  it("rejects a missing bearer token before reading or saving a reaction", async () => {
    const dependencies = createDependencies();
    const handler = createReactionPostHandler(dependencies);
    const request = createRequest(undefined, "");

    const response = await handler(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await readBody(response)).toEqual({
      error: {
        code: "AUTH_REQUIRED",
        message: "로그인 후 반응을 남길 수 있습니다.",
      },
    });
    expect(dependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(dependencies.saveReaction).not.toHaveBeenCalled();
  });

  it("rejects malformed authorization and invalid tokens", async () => {
    const malformedDependencies = createDependencies();
    const malformedHandler = createReactionPostHandler(malformedDependencies);

    expect((await malformedHandler(createRequest(undefined, "Basic token"))).status).toBe(
      401,
    );
    expect(malformedDependencies.verifyAccessToken).not.toHaveBeenCalled();

    const invalidDependencies = createDependencies({
      verifyAccessToken: vi.fn(async () => null),
    });
    const invalidResponse = await createReactionPostHandler(invalidDependencies)(
      createRequest(),
    );

    expect(invalidResponse.status).toBe(401);
    expect(await readBody(invalidResponse)).toMatchObject({
      error: { code: "INVALID_TOKEN" },
    });
    expect(invalidDependencies.saveReaction).not.toHaveBeenCalled();
  });

  it("accepts only the exact restaurantId and three-state reaction contract", async () => {
    const invalidBodies = [
      { restaurantId: "not-a-uuid", kind: "like" },
      { restaurantId, kind: "love" },
      { restaurantId, kind: "like", userId },
      { restaurantId, kind: "like", rating: 5 },
      null,
    ];

    for (const body of invalidBodies) {
      const dependencies = createDependencies();
      const response = await createReactionPostHandler(dependencies)(
        createRequest(body),
      );

      expect(response.status).toBe(400);
      expect(await readBody(response)).toMatchObject({
        error: { code: "INVALID_REQUEST" },
      });
      expect(dependencies.saveReaction).not.toHaveBeenCalled();
    }
  });

  it("rejects malformed JSON without exposing the parser error", async () => {
    const dependencies = createDependencies();
    const handler = createReactionPostHandler(dependencies);
    const request = new Request("http://localhost/api/reactions", {
      method: "POST",
      headers: {
        authorization: "Bearer user-access-token",
        "content-type": "application/json",
      },
      body: "{broken",
    });

    const response = await handler(request);

    expect(response.status).toBe(400);
    expect(JSON.stringify(await readBody(response))).not.toContain("SyntaxError");
    expect(dependencies.saveReaction).not.toHaveBeenCalled();
  });

  it("uses only the verified Auth user id and returns a private-only creation", async () => {
    const dependencies = createDependencies();
    const response = await createReactionPostHandler(dependencies)(createRequest());

    expect(response.status).toBe(201);
    expect(dependencies.verifyAccessToken).toHaveBeenCalledWith("user-access-token");
    expect(dependencies.saveReaction).toHaveBeenCalledWith({
      userId,
      restaurantId,
      kind: "like",
    });
    expect(await readBody(response)).toEqual({ reaction: savedReaction });
  });

  it("returns 200 for an update or idempotent retry", async () => {
    const updatedReaction = {
      ...savedReaction,
      kind: "okay" as const,
      wasCreated: false,
      wasChanged: false,
    };
    const dependencies = createDependencies({
      saveReaction: vi.fn(async () => updatedReaction),
    });
    const response = await createReactionPostHandler(dependencies)(
      createRequest({ restaurantId, kind: "okay" }),
    );

    expect(response.status).toBe(200);
    expect(await readBody(response)).toEqual({ reaction: updatedReaction });
  });

  it("returns safe service errors without leaking upstream details", async () => {
    const authFailure = createReactionPostHandler(
      createDependencies({
        verifyAccessToken: vi.fn(async () => {
          throw new Error("token=secret-auth-value");
        }),
      }),
    );
    const authResponse = await authFailure(createRequest());

    expect(authResponse.status).toBe(503);
    expect(JSON.stringify(await readBody(authResponse))).not.toContain("secret-auth-value");

    const saveFailure = createReactionPostHandler(
      createDependencies({
        saveReaction: vi.fn(async () => {
          throw new Error("database=private-connection-details");
        }),
      }),
    );
    const saveResponse = await saveFailure(createRequest());

    expect(saveResponse.status).toBe(503);
    expect(JSON.stringify(await readBody(saveResponse))).not.toContain(
      "private-connection-details",
    );
  });
});

describe("Supabase reaction transport", () => {
  const environment = {
    NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public-test",
    SUPABASE_SECRET_KEY: "sb_secret_server-only-test",
  };

  it("verifies the bearer token with the public key and no secret key", async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({ id: userId }, { status: 200 });
      },
    );
    const dependencies = createSupabaseReactionDependencies(
      environment,
      fetchImplementation,
    );

    await expect(dependencies.verifyAccessToken("user-access-token")).resolves.toEqual({
      id: userId,
    });

    const [url, init] = fetchImplementation.mock.calls[0];
    expect(String(url)).toBe("https://project-ref.supabase.co/auth/v1/user");
    expect(init?.headers).toEqual({
      apikey: "sb_publishable_public-test",
      authorization: "Bearer user-access-token",
    });
    expect(JSON.stringify(init)).not.toContain("sb_secret_server-only-test");
  });

  it("returns null for a rejected Auth token", async () => {
    const dependencies = createSupabaseReactionDependencies(
      environment,
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    await expect(dependencies.verifyAccessToken("expired-token")).resolves.toBeNull();
  });

  it("uses the secret as apikey only for the server RPC", async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json(
          [
            {
              reaction_id: reactionId,
              reaction_kind: "like",
              moderation_status: "private_only",
              was_created: true,
              was_changed: true,
              saved_at: "2026-08-25T07:00:00.000Z",
            },
          ],
          { status: 200 },
        );
      },
    );
    const dependencies = createSupabaseReactionDependencies(
      environment,
      fetchImplementation,
    );

    await expect(
      dependencies.saveReaction({ userId, restaurantId, kind: "like" }),
    ).resolves.toEqual(savedReaction);

    const [url, init] = fetchImplementation.mock.calls[0];
    expect(String(url)).toBe(
      "https://project-ref.supabase.co/rest/v1/rpc/save_reaction_selection",
    );
    expect(init?.headers).toEqual({
      Accept: "application/json",
      apikey: "sb_secret_server-only-test",
      "Content-Type": "application/json",
    });
    expect(init?.headers).not.toHaveProperty("authorization");
    expect(JSON.parse(String(init?.body))).toEqual({
      p_user_id: userId,
      p_restaurant_id: restaurantId,
      p_kind: "like",
    });
  });

  it("fails closed when configuration or the RPC response is invalid", async () => {
    const missingConfiguration = createSupabaseReactionDependencies(
      { ...environment, SUPABASE_SECRET_KEY: " " },
      vi.fn(),
    );

    await expect(
      missingConfiguration.saveReaction({ userId, restaurantId, kind: "like" }),
    ).rejects.toThrow("configuration");

    const invalidResponse = createSupabaseReactionDependencies(
      environment,
      vi.fn(async () => Response.json([{ reaction_id: "not-a-uuid" }], { status: 200 })),
    );

    await expect(
      invalidResponse.saveReaction({ userId, restaurantId, kind: "like" }),
    ).rejects.toThrow("unavailable");
  });

  it("maps a missing active restaurant without exposing the database error", async () => {
    const fetchImplementation = vi
      .fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ id: userId }, { status: 200 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            code: "23503",
            details: "private database details",
            message: "active restaurant does not exist",
          },
          { status: 400 },
        ),
      );
    const dependencies = createSupabaseReactionDependencies(
      environment,
      fetchImplementation,
    );
    const response = await createReactionPostHandler(dependencies)(createRequest());
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body).toMatchObject({ error: { code: "RESTAURANT_NOT_FOUND" } });
    expect(JSON.stringify(body)).not.toContain("private database details");
    expect(JSON.stringify(body)).not.toContain("active restaurant does not exist");
  });

  it("maps missing server configuration to a safe 503 response", async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({ id: userId }, { status: 200 });
      },
    );
    const dependencies = createSupabaseReactionDependencies(
      { ...environment, SUPABASE_SECRET_KEY: undefined },
      fetchImplementation,
    );
    const response = await createReactionPostHandler(dependencies)(createRequest());

    expect(response.status).toBe(503);
    expect(await readBody(response)).toMatchObject({
      error: { code: "SERVICE_NOT_CONFIGURED" },
    });
  });
});
