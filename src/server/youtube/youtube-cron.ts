import { timingSafeEqual } from "node:crypto";

import { runYouTubeSync } from "./run-youtube-sync";
import { YouTubeRepositoryError } from "./supabase-youtube-repository";
import type { SyncTriggerKind, YouTubeSyncResult } from "./youtube-sync";

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;
type SyncRunner = (
  triggerKind: SyncTriggerKind,
  environment: RuntimeEnvironment,
) => Promise<YouTubeSyncResult>;

type CronHandlerOptions = {
  environment?: RuntimeEnvironment;
  runSync?: SyncRunner;
};

function json(body: Readonly<Record<string, unknown>>, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function hasValidSecret(request: Request, secret: string) {
  const actual = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);

  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

export function createYouTubeCronHandler(options: CronHandlerOptions = {}) {
  const environment = options.environment ?? process.env;
  const runSync = options.runSync ?? runYouTubeSync;

  return async function GET(request: Request) {
    const secret = environment.CRON_SECRET?.trim();

    if (!secret) {
      return json({ status: "misconfigured" }, 503);
    }

    if (!hasValidSecret(request, secret)) {
      return json({ status: "unauthorized" }, 401);
    }

    try {
      const result = await runSync("cron", environment);

      return json(
        {
          status: result.status,
          runId: result.runId,
          successfulChannelCount: result.successfulChannelCount,
          failedChannelCount: result.failedChannelCount,
          processedVideoCount: result.processedVideoCount,
          candidateCount: result.candidateCount,
          apiRequestCount: result.apiRequestCount,
        },
        200,
      );
    } catch (error) {
      if (
        error instanceof YouTubeRepositoryError &&
        error.kind === "already_running"
      ) {
        return json({ status: "already_running" }, 202);
      }

      return json({ status: "unavailable" }, 503);
    }
  };
}
