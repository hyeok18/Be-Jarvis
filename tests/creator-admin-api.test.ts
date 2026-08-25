import { describe, expect, it, vi } from "vitest";

import {
  createCreatorEvidenceGetHandler,
  createEvidenceDecisionPostHandler,
  createManualSyncPostHandler,
  type AdminApiDependencies,
} from "../src/server/admin/creator-admin-api";

const adminId = "20000000-0000-4000-8000-000000000001";
const evidenceId = "10000000-0000-4000-8000-000000000001";

function createDependencies(
  overrides: Partial<AdminApiDependencies> = {},
): AdminApiDependencies {
  return {
    auth: { verifyAdminAccessToken: vi.fn(async () => ({ id: adminId, email: null })) },
    repository: {
      listEvidence: vi.fn(async () => []),
      listSyncRuns: vi.fn(async () => []),
      confirmEvidence: vi.fn(async () => undefined),
      rejectEvidence: vi.fn(async () => undefined),
    },
    runSync: vi.fn(async () => ({
      runId: "30000000-0000-4000-8000-000000000001",
      status: "succeeded" as const,
      successfulChannelCount: 5,
      failedChannelCount: 0,
      processedVideoCount: 3,
      candidateCount: 1,
      apiRequestCount: 8,
    })),
    now: () => new Date("2026-08-25T10:00:00.000Z"),
    ...overrides,
  };
}

function adminRequest(path: string, method = "GET", body?: unknown) {
  return new Request(`https://example.com${path}`, {
    method,
    headers: {
      cookie: "be_jarvis_admin_session=admin-token",
      origin: "https://example.com",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("creator admin API", () => {
  it("does not read server data without a verified admin session", async () => {
    const dependencies = createDependencies({
      auth: { verifyAdminAccessToken: vi.fn(async () => null) },
    });
    const response = await createCreatorEvidenceGetHandler(dependencies)(
      new Request("https://example.com/api/admin/creator-visits"),
    );

    expect(response.status).toBe(401);
    expect(dependencies.repository.listEvidence).not.toHaveBeenCalled();
  });

  it("rejects cross-origin state changes before auth or database calls", async () => {
    const dependencies = createDependencies();
    const request = new Request("https://example.com/api/admin/creators/sync", {
      method: "POST",
      headers: {
        cookie: "be_jarvis_admin_session=admin-token",
        origin: "https://attacker.example",
      },
    });
    const response = await createManualSyncPostHandler(dependencies)(request);

    expect(response.status).toBe(403);
    expect(dependencies.auth.verifyAdminAccessToken).not.toHaveBeenCalled();
    expect(dependencies.runSync).not.toHaveBeenCalled();
  });

  it("confirms a candidate with the verified admin id", async () => {
    const dependencies = createDependencies();
    const handler = createEvidenceDecisionPostHandler(dependencies, "confirm");
    const response = await handler(
      adminRequest(`/api/admin/creator-visits/${evidenceId}/confirm`, "POST", {
        confirmationNote: "상호와 방문 장면 확인",
        videoTimestampSeconds: 42,
      }),
      { params: Promise.resolve({ id: evidenceId }) },
    );

    expect(response.status).toBe(200);
    expect(dependencies.repository.confirmEvidence).toHaveBeenCalledWith({
      evidenceId,
      adminUserId: adminId,
      confirmationNote: "상호와 방문 장면 확인",
      videoTimestampSeconds: 42,
      decidedAt: "2026-08-25T10:00:00.000Z",
    });
  });

  it("rejects unknown fields and invalid video timestamps", async () => {
    const dependencies = createDependencies();
    const handler = createEvidenceDecisionPostHandler(dependencies, "confirm");

    for (const body of [
      { status: "confirmed" },
      { videoTimestampSeconds: -1 },
      { videoTimestampSeconds: 86_401 },
    ]) {
      const response = await handler(
        adminRequest(`/api/admin/creator-visits/${evidenceId}/confirm`, "POST", body),
        { params: Promise.resolve({ id: evidenceId }) },
      );
      expect(response.status).toBe(400);
    }

    expect(dependencies.repository.confirmEvidence).not.toHaveBeenCalled();
  });

  it("starts the shared manual sync only after authorization", async () => {
    const dependencies = createDependencies();
    const response = await createManualSyncPostHandler(dependencies)(
      adminRequest("/api/admin/creators/sync", "POST"),
    );

    expect(response.status).toBe(202);
    expect(dependencies.runSync).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({
      run: { status: "succeeded", candidateCount: 1 },
    });
  });
});
