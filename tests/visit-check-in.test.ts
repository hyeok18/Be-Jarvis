import { describe, expect, it, vi } from "vitest";

import {
  requestLocationVisitProof,
  VisitCheckInError,
} from "../src/components/restaurant-detail/visit-check-in";

const restaurantId = "10000000-0000-4000-8000-000000000001";
const proofToken = "p".repeat(43);

function createGeolocation(
  result:
    | { kind: "success"; latitude: number; longitude: number; accuracy: number }
    | { kind: "error"; code: number },
) {
  return {
    getCurrentPosition: vi.fn(
      (
        success: PositionCallback,
        error?: PositionErrorCallback | null,
        options?: PositionOptions,
      ) => {
        if (result.kind === "success") {
          success({
            coords: {
              latitude: result.latitude,
              longitude: result.longitude,
              accuracy: result.accuracy,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: 123456789,
            toJSON: () => ({}),
          });
        } else {
          error?.({
            code: result.code,
            message: "private browser position detail",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }

        expect(options).toEqual({
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10_000,
        });
      },
    ),
  } satisfies Pick<Geolocation, "getCurrentPosition">;
}

describe("browser location check-in", () => {
  it("requests fresh high-accuracy location and sends only minimal coordinates", async () => {
    const geolocation = createGeolocation({
      kind: "success",
      latitude: 37.543,
      longitude: 127.05,
      accuracy: 25,
    });
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json(
          {
            visitProof: {
              token: proofToken,
              method: "location_checkin",
              expiresAt: "2026-08-26T10:00:00.000Z",
            },
          },
          { status: 201 },
        );
      },
    );

    await expect(
      requestLocationVisitProof(
        { accessToken: "access-token", restaurantId },
        geolocation,
        fetchImplementation,
      ),
    ).resolves.toEqual({
      token: proofToken,
      expiresAt: "2026-08-26T10:00:00.000Z",
    });

    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImplementation.mock.calls[0];
    expect(url).toBe("/api/visits/check-in");
    expect(init?.headers).toEqual({
      authorization: "Bearer access-token",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      restaurantId,
      latitude: 37.543,
      longitude: 127.05,
      accuracyMeters: 25,
    });
    expect(String(init?.body)).not.toContain("timestamp");
    expect(String(init?.body)).not.toContain("coords");
  });

  it.each([
    [1, "permission_denied"],
    [2, "position_unavailable"],
    [3, "timeout"],
  ] as const)("maps geolocation error %i without calling the server", async (code, kind) => {
    const geolocation = createGeolocation({ kind: "error", code });
    const fetchImplementation = vi.fn();

    await expect(
      requestLocationVisitProof(
        { accessToken: "access-token", restaurantId },
        geolocation,
        fetchImplementation,
      ),
    ).rejects.toMatchObject({ kind });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it.each([
    [422, "ACCURACY_INSUFFICIENT", "accuracy_insufficient"],
    [422, "OUT_OF_RANGE", "out_of_range"],
    [401, "AUTH_REQUIRED", "auth_required"],
    [503, "VISIT_PROOF_UNAVAILABLE", "service_unavailable"],
  ] as const)("maps server %i/%s to %s", async (status, code, kind) => {
    const geolocation = createGeolocation({
      kind: "success",
      latitude: 37.543,
      longitude: 127.05,
      accuracy: 25,
    });

    await expect(
      requestLocationVisitProof(
        { accessToken: "access-token", restaurantId },
        geolocation,
        async () => Response.json({ error: { code } }, { status }),
      ),
    ).rejects.toMatchObject({ kind, status });
  });

  it("fails closed for an invalid success DTO or network error", async () => {
    const geolocation = createGeolocation({
      kind: "success",
      latitude: 37.543,
      longitude: 127.05,
      accuracy: 25,
    });

    await expect(
      requestLocationVisitProof(
        { accessToken: "access-token", restaurantId },
        geolocation,
        async () => Response.json({ visitProof: { token: "short" } }),
      ),
    ).rejects.toBeInstanceOf(VisitCheckInError);

    await expect(
      requestLocationVisitProof(
        { accessToken: "access-token", restaurantId },
        geolocation,
        async () => {
          throw new Error("private network details");
        },
      ),
    ).rejects.toMatchObject({ kind: "service_unavailable" });
  });
});
