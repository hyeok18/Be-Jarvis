import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseVisitProofDependencies,
  createVisitCheckInPostHandler,
  type IssuedLocationProof,
  type VisitProofApiDependencies,
} from "../src/server/visits/visit-proof-api";
import { digestVisitProofToken } from "../src/server/visits/visit-proof-token";

const userId = "10000000-0000-4000-8000-000000000001";
const restaurantId = "20000000-0000-4000-8000-000000000001";
const proofId = "30000000-0000-4000-8000-000000000001";
const proofToken = "a".repeat(43);

const issuedProof: IssuedLocationProof = {
  proofId,
  isValid: true,
  reasonCode: null,
  expiresAt: "2026-08-26T10:00:00.000Z",
};

function createRequest(
  body: unknown = {
    restaurantId,
    latitude: 37.543,
    longitude: 127.05,
    accuracyMeters: 25,
  },
  authorization = "Bearer user-access-token",
) {
  return new Request("http://localhost/api/visits/check-in", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createDependencies(
  overrides: Partial<VisitProofApiDependencies> = {},
): VisitProofApiDependencies {
  return {
    verifyAccessToken: vi.fn(async () => ({ id: userId })),
    issueLocationProof: vi.fn(async () => issuedProof),
    createProofToken: () => proofToken,
    ...overrides,
  };
}

async function readBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("POST /api/visits/check-in", () => {
  it("requires a valid bearer token before accepting location data", async () => {
    const missingDependencies = createDependencies();
    const missingResponse = await createVisitCheckInPostHandler(
      missingDependencies,
    )(createRequest(undefined, ""));

    expect(missingResponse.status).toBe(401);
    expect(missingDependencies.verifyAccessToken).not.toHaveBeenCalled();
    expect(missingDependencies.issueLocationProof).not.toHaveBeenCalled();

    const invalidDependencies = createDependencies({
      verifyAccessToken: vi.fn(async () => null),
    });
    const invalidResponse = await createVisitCheckInPostHandler(
      invalidDependencies,
    )(createRequest());

    expect(invalidResponse.status).toBe(401);
    expect(invalidDependencies.issueLocationProof).not.toHaveBeenCalled();
  });

  it("accepts only the exact restaurant and minimal location contract", async () => {
    const invalidBodies = [
      { restaurantId, latitude: 91, longitude: 127, accuracyMeters: 10 },
      { restaurantId, latitude: 37, longitude: 181, accuracyMeters: 10 },
      { restaurantId, latitude: 37, longitude: 127, accuracyMeters: -1 },
      {
        restaurantId,
        latitude: 37,
        longitude: 127,
        accuracyMeters: 10,
        timestamp: 123,
      },
      { restaurantId: "not-a-uuid", latitude: 37, longitude: 127, accuracyMeters: 10 },
      null,
    ];

    for (const body of invalidBodies) {
      const dependencies = createDependencies();
      const response = await createVisitCheckInPostHandler(dependencies)(
        createRequest(body),
      );

      expect(response.status).toBe(400);
      expect(dependencies.issueLocationProof).not.toHaveBeenCalled();
    }
  });

  it("returns an opaque proof while sending only its digest to the database", async () => {
    const dependencies = createDependencies();
    const response = await createVisitCheckInPostHandler(dependencies)(
      createRequest(),
    );
    const body = await readBody(response);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(dependencies.issueLocationProof).toHaveBeenCalledWith({
      userId,
      restaurantId,
      evidenceDigest: digestVisitProofToken(proofToken),
      latitude: 37.543,
      longitude: 127.05,
      accuracyMeters: 25,
    });
    expect(body).toEqual({
      visitProof: {
        token: proofToken,
        method: "location_checkin",
        expiresAt: issuedProof.expiresAt,
      },
    });
    expect(JSON.stringify(body)).not.toContain(proofId);
  });

  it.each([
    ["ACCURACY_INSUFFICIENT" as const, "정확도가 부족"],
    ["OUT_OF_RANGE" as const, "식당 근처"],
    ["INVALID_LOCATION" as const, "위치를 확인하지 못했"],
  ])("returns safe retry copy for %s", async (reasonCode, message) => {
    const dependencies = createDependencies({
      issueLocationProof: vi.fn(async () => ({
        ...issuedProof,
        isValid: false,
        reasonCode,
        expiresAt: null,
      })),
    });
    const response = await createVisitCheckInPostHandler(dependencies)(
      createRequest(),
    );
    const body = await readBody(response);

    expect(response.status).toBe(422);
    expect(JSON.stringify(body)).toContain(message);
    expect(JSON.stringify(body)).not.toContain(proofToken);
    expect(JSON.stringify(body)).not.toContain("37.543");
  });

  it("normalizes upstream failures without leaking coordinates or secrets", async () => {
    const dependencies = createDependencies({
      issueLocationProof: vi.fn(async () => {
        throw new Error("latitude=37.543 token=server-secret");
      }),
    });
    const response = await createVisitCheckInPostHandler(dependencies)(
      createRequest(),
    );
    const serialized = JSON.stringify(await readBody(response));

    expect(response.status).toBe(503);
    expect(serialized).not.toContain("37.543");
    expect(serialized).not.toContain("server-secret");
  });
});

describe("Supabase location proof transport", () => {
  const environment = {
    NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_server-only-test",
  };

  const input = {
    userId,
    restaurantId,
    evidenceDigest: digestVisitProofToken(proofToken),
    latitude: 37.543,
    longitude: 127.05,
    accuracyMeters: 25,
  };

  it("uses the server secret and sends no raw token or browser payload", async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json(
          [
            {
              visit_proof_id: proofId,
              is_valid: true,
              reason_code: null,
              expires_at: issuedProof.expiresAt,
            },
          ],
          { status: 200 },
        );
      },
    );
    const dependencies = createSupabaseVisitProofDependencies(
      environment,
      fetchImplementation,
    );

    await expect(dependencies.issueLocationProof(input)).resolves.toEqual(
      issuedProof,
    );

    const [url, init] = fetchImplementation.mock.calls[0];
    expect(String(url)).toBe(
      "https://project-ref.supabase.co/rest/v1/rpc/issue_location_visit_proof",
    );
    expect(init?.headers).toEqual({
      Accept: "application/json",
      apikey: "sb_secret_server-only-test",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      p_user_id: userId,
      p_restaurant_id: restaurantId,
      p_evidence_digest: input.evidenceDigest,
      p_user_latitude: 37.543,
      p_user_longitude: 127.05,
      p_accuracy_meters: 25,
    });
    expect(String(init?.body)).not.toContain(proofToken);
    expect(String(init?.body)).not.toContain("coords");
    expect(String(init?.body)).not.toContain("timestamp");
  });

  it("fails closed for missing configuration or an invalid DTO", async () => {
    const missingConfiguration = createSupabaseVisitProofDependencies(
      { ...environment, SUPABASE_SECRET_KEY: " " },
      vi.fn(),
    );
    await expect(
      missingConfiguration.issueLocationProof(input),
    ).rejects.toThrow("configuration");

    const invalidResponse = createSupabaseVisitProofDependencies(
      environment,
      vi.fn(async () => Response.json([{ visit_proof_id: "invalid" }])),
    );
    await expect(invalidResponse.issueLocationProof(input)).rejects.toThrow(
      "unavailable",
    );
  });

  it("maps an inactive restaurant to safe 404 copy", async () => {
    const transport = createSupabaseVisitProofDependencies(
      environment,
      vi.fn(async () =>
        Response.json(
          {
            code: "23503",
            message: "active restaurant does not exist",
            details: "private database details",
          },
          { status: 400 },
        ),
      ),
    );
    const response = await createVisitCheckInPostHandler({
      verifyAccessToken: vi.fn(async () => ({ id: userId })),
      issueLocationProof: transport.issueLocationProof,
      createProofToken: () => proofToken,
    })(createRequest());
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body).toMatchObject({ error: { code: "RESTAURANT_NOT_FOUND" } });
    expect(JSON.stringify(body)).not.toContain("private database details");
  });
});
