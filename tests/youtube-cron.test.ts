import { describe, expect, it, vi } from "vitest";

import { YouTubeRepositoryError } from "../src/server/youtube/supabase-youtube-repository";
import { createYouTubeCronHandler } from "../src/server/youtube/youtube-cron";
import type { YouTubeSyncResult } from "../src/server/youtube/youtube-sync";

const secret = "cron-secret-for-tests";
const environment = { CRON_SECRET: secret };
const successfulResult: YouTubeSyncResult = {
  runId: "run-1",
  status: "succeeded",
  successfulChannelCount: 5,
  failedChannelCount: 0,
  processedVideoCount: 3,
  candidateCount: 1,
  apiRequestCount: 8,
};

function request(authorization?: string) {
  return new Request("https://example.com/api/cron/youtube-sync", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("WU-14 YouTube Cron handler", () => {
  it("fails closed when CRON_SECRET is missing", async () => {
    const runSync = vi.fn();
    const handler = createYouTubeCronHandler({ environment: {}, runSync });

    const response = await handler(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "misconfigured" });
    expect(runSync).not.toHaveBeenCalled();
  });

  it("rejects a missing or incorrect bearer secret without starting a sync", async () => {
    const runSync = vi.fn();
    const handler = createYouTubeCronHandler({ environment, runSync });

    const missing = await handler(request());
    const incorrect = await handler(request("Bearer incorrect"));

    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
    expect(runSync).not.toHaveBeenCalled();
  });

  it("runs an authenticated Cron sync and returns only bounded counters", async () => {
    const runSync = vi.fn(async () => successfulResult);
    const handler = createYouTubeCronHandler({ environment, runSync });

    const response = await handler(request(`Bearer ${secret}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual(successfulResult);
    expect(runSync).toHaveBeenCalledWith("cron", environment);
  });

  it("treats a concurrent run as an accepted no-op", async () => {
    const runSync = vi.fn(async () => {
      throw new YouTubeRepositoryError("already_running", 409);
    });
    const handler = createYouTubeCronHandler({ environment, runSync });

    const response = await handler(request(`Bearer ${secret}`));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      status: "already_running",
    });
  });

  it("does not leak upstream error details", async () => {
    const runSync = vi.fn(async () => {
      throw new Error("sensitive upstream response");
    });
    const handler = createYouTubeCronHandler({ environment, runSync });

    const response = await handler(request(`Bearer ${secret}`));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toBe('{"status":"unavailable"}');
    expect(body).not.toContain("sensitive");
  });
});
