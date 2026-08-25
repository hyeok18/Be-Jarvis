import { describe, expect, it } from "vitest";

import { creatorAllowlist } from "../src/server/youtube/creator-allowlist";
import { runYouTubeSync } from "../src/server/youtube/run-youtube-sync";

const runIntegration = process.env.RUN_YOUTUBE_INTEGRATION === "1";

describe.runIf(runIntegration)("WU-12 live YouTube and Supabase sync", () => {
  it(
    "synchronizes all allowlisted channels into the configured project",
    async () => {
      const result = await runYouTubeSync("manual");

      expect(result.status).toBe("succeeded");
      expect(result.successfulChannelCount).toBe(5);
      expect(result.failedChannelCount).toBe(0);
      expect(result.apiRequestCount).toBeGreaterThan(0);
      expect(result.processedVideoCount).toBeGreaterThanOrEqual(0);
      expect(result.candidateCount).toBeGreaterThanOrEqual(0);

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const secretKey = process.env.SUPABASE_SECRET_KEY;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

      expect(baseUrl).toMatch(/^https:\/\//);
      expect(secretKey).toMatch(/^sb_secret_/);
      expect(publishableKey).toMatch(/^sb_publishable_/);

      async function readServerRows(
        table: string,
        parameters: Record<string, string>,
      ) {
        const url = new URL(`/rest/v1/${table}`, baseUrl!);

        for (const [name, value] of Object.entries(parameters)) {
          url.searchParams.set(name, value);
        }

        const response = await fetch(url, {
          headers: { Accept: "application/json", apikey: secretKey! },
        });

        expect(response.ok).toBe(true);
        const value: unknown = await response.json();
        expect(Array.isArray(value)).toBe(true);
        return value as Record<string, unknown>[];
      }

      const channels = await readServerRows("creator_channels", {
        select: "id,is_allowlisted,is_active,uploads_playlist_id",
        youtube_channel_id: `in.(${creatorAllowlist
          .map((entry) => entry.youtubeChannelId)
          .join(",")})`,
      });

      expect(channels).toHaveLength(5);
      expect(
        channels.every(
          (channel) =>
            channel.is_allowlisted === true &&
            channel.is_active === true &&
            typeof channel.uploads_playlist_id === "string",
        ),
      ).toBe(true);

      const videos = await readServerRows("creator_videos", {
        select: "id,privacy_status,is_active",
        creator_channel_id: `in.(${channels
          .map((channel) => String(channel.id))
          .join(",")})`,
      });

      expect(videos.length).toBeGreaterThan(0);
      expect(
        videos.every(
          (video) =>
            video.privacy_status === "public" && video.is_active === true,
        ),
      ).toBe(true);

      const runs = await readServerRows("youtube_sync_runs", {
        select:
          "status,api_request_count,processed_video_count,candidate_count,error_summary",
        id: `eq.${result.runId}`,
      });

      expect(runs).toEqual([
        expect.objectContaining({
          status: "succeeded",
          error_summary: null,
        }),
      ]);

      const publicUrl = new URL(
        "/rest/v1/creator_visit_evidence?select=id&limit=1",
        baseUrl!,
      );
      const publicResponse = await fetch(publicUrl, {
        headers: { Accept: "application/json", apikey: publishableKey! },
      });

      expect([401, 403]).toContain(publicResponse.status);
    },
    120_000,
  );
});
