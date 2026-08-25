import { describe, expect, it } from "vitest";

import { createSupabaseYouTubeRepository } from "../src/server/youtube/supabase-youtube-repository";

const runIntegration = process.env.RUN_YOUTUBE_CRON_INTEGRATION === "1";

describe.runIf(runIntegration)("WU-14 live YouTube sync lock", () => {
  it(
    "rejects a concurrent run and recovers an expired run",
    async () => {
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const secretKey = process.env.SUPABASE_SECRET_KEY;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

      expect(baseUrl).toMatch(/^https:\/\//);
      expect(secretKey).toMatch(/^sb_secret_/);
      expect(publishableKey).toMatch(/^sb_publishable_/);

      const publicLockUrl = new URL(
        "/rest/v1/rpc/acquire_youtube_sync_run",
        baseUrl!,
      );
      const publicLockResponse = await fetch(publicLockUrl, {
        method: "POST",
        headers: {
          apikey: publishableKey!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_trigger_kind: "cron",
          p_started_at: new Date().toISOString(),
        }),
      });
      expect([401, 403]).toContain(publicLockResponse.status);

      const environment = {
        NEXT_PUBLIC_SUPABASE_URL: baseUrl,
        SUPABASE_SECRET_KEY: secretKey,
      };
      const repository = createSupabaseYouTubeRepository(environment);
      const now = new Date();
      const first = await repository.startRun("cron", now.toISOString());
      let activeRunId = first.id;

      try {
        await expect(
          repository.startRun("cron", new Date(now.getTime() + 1_000).toISOString()),
        ).rejects.toMatchObject({ kind: "already_running" });

        const staleStartedAt = new Date(
          now.getTime() - 30 * 60 * 1_000,
        ).toISOString();
        const staleUrl = new URL("/rest/v1/youtube_sync_runs", baseUrl!);
        staleUrl.searchParams.set("id", `eq.${first.id}`);
        const staleResponse = await fetch(staleUrl, {
          method: "PATCH",
          headers: {
            apikey: secretKey!,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ started_at: staleStartedAt }),
        });
        expect(staleResponse.ok).toBe(true);

        const replacement = await repository.startRun("cron", now.toISOString());
        activeRunId = replacement.id;

        const firstRunUrl = new URL("/rest/v1/youtube_sync_runs", baseUrl!);
        firstRunUrl.searchParams.set("select", "status,error_summary,finished_at");
        firstRunUrl.searchParams.set("id", `eq.${first.id}`);
        const firstRunResponse = await fetch(firstRunUrl, {
          headers: { Accept: "application/json", apikey: secretKey! },
        });
        expect(firstRunResponse.ok).toBe(true);
        await expect(firstRunResponse.json()).resolves.toEqual([
          expect.objectContaining({
            status: "failed",
            error_summary: "expired_running_lock",
            finished_at: expect.any(String),
          }),
        ]);
      } finally {
        await repository.finishRun({
          runId: activeRunId,
          status: "succeeded",
          apiRequestCount: 0,
          processedVideoCount: 0,
          candidateCount: 0,
          errorSummary: null,
          finishedAt: new Date().toISOString(),
        });
      }
    },
    30_000,
  );
});
