import { describe, expect, it, vi } from "vitest";

import { createSupabaseYouTubeRepository } from "../src/server/youtube/supabase-youtube-repository";

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_server-only-test",
};

describe("Supabase YouTube repository", () => {
  it("uses only the server secret and upserts hidden subscriber data safely", async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json(
          [{ id: "channel-row-1", youtube_channel_id: "channel-1" }],
          { status: 200 },
        );
      },
    );
    const repository = createSupabaseYouTubeRepository(environment, {
      fetch: fetchImplementation,
    });

    await expect(
      repository.upsertChannel(
        {
          youtubeChannelId: "channel-1",
          title: "테스트 채널",
          thumbnailUrl: null,
          subscriberCount: null,
          subscriberCountHidden: true,
          uploadsPlaylistId: "uploads-1",
        },
        "2026-08-25T08:00:00.000Z",
      ),
    ).resolves.toEqual({
      id: "channel-row-1",
      youtubeChannelId: "channel-1",
    });

    const [url, init] = fetchImplementation.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe(
      "https://project-ref.supabase.co/rest/v1/creator_channels",
    );
    expect(parsed.searchParams.get("on_conflict")).toBe("youtube_channel_id");
    expect(init?.headers).toMatchObject({
      apikey: "sb_secret_server-only-test",
      Prefer: "resolution=merge-duplicates,return=representation",
    });
    expect(init?.headers).not.toHaveProperty("authorization");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      subscriber_count: null,
      subscriber_count_hidden: true,
      is_allowlisted: true,
    });
  });

  it("marks unavailable videos inactive before making their evidence stale", async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return new Response(null, { status: 204 });
      },
    );
    const repository = createSupabaseYouTubeRepository(environment, {
      fetch: fetchImplementation,
    });

    await repository.markVideosUnavailable({
      videoIds: ["video-row-1"],
      metadataFetchedAt: "2026-08-25T08:00:00.000Z",
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    const [videoUrl, videoInit] = fetchImplementation.mock.calls[0];
    const [evidenceUrl, evidenceInit] = fetchImplementation.mock.calls[1];
    expect(new URL(String(videoUrl)).pathname).toBe(
      "/rest/v1/creator_videos",
    );
    expect(JSON.parse(String(videoInit?.body))).toEqual({
      privacy_status: "deleted",
      is_active: false,
      metadata_fetched_at: "2026-08-25T08:00:00.000Z",
    });
    expect(new URL(String(evidenceUrl)).pathname).toBe(
      "/rest/v1/creator_visit_evidence",
    );
    expect(JSON.parse(String(evidenceInit?.body))).toEqual({ status: "stale" });
  });

  it("creates candidates idempotently and does not overwrite prior decisions", async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json([{ id: "evidence-1" }], { status: 201 });
      },
    );
    const repository = createSupabaseYouTubeRepository(environment, {
      fetch: fetchImplementation,
    });

    await expect(
      repository.createCandidateEvidence([
        { creatorVideoId: "video-row-1", restaurantId: "restaurant-1" },
      ]),
    ).resolves.toBe(1);

    const [url, init] = fetchImplementation.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("on_conflict")).toBe(
      "creator_video_id,restaurant_id",
    );
    expect(init?.headers).toMatchObject({
      Prefer: "resolution=ignore-duplicates,return=representation",
    });
  });

  it("fails before a request when the server configuration is missing", () => {
    expect(() =>
      createSupabaseYouTubeRepository({
        NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
      }),
    ).toThrow("configuration");
  });
});
