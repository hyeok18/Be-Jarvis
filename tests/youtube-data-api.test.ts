import { describe, expect, it, vi } from "vitest";

import {
  createYouTubeDataApiClient,
  YouTubeDataApiError,
} from "../src/server/youtube/youtube-data-api";

describe("YouTube Data API v3 adapter", () => {
  it("reads the uploads playlist and never stores a hidden subscriber count", async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({
          items: [
            {
              id: "channel-1",
              snippet: {
                title: "테스트 채널",
                thumbnails: {
                  high: { url: "https://i.ytimg.com/channel.jpg" },
                },
              },
              statistics: {
                hiddenSubscriberCount: true,
                subscriberCount: "999999",
              },
              contentDetails: {
                relatedPlaylists: { uploads: "uploads-1" },
              },
            },
          ],
        });
      },
    );
    const client = createYouTubeDataApiClient({
      apiKey: "server-only-key",
      fetch: fetchImplementation,
    });

    await expect(client.listChannels(["channel-1"])).resolves.toEqual([
      {
        youtubeChannelId: "channel-1",
        title: "테스트 채널",
        thumbnailUrl: "https://i.ytimg.com/channel.jpg",
        subscriberCount: null,
        subscriberCountHidden: true,
        uploadsPlaylistId: "uploads-1",
      },
    ]);

    const [url] = fetchImplementation.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe(
      "https://www.googleapis.com/youtube/v3/channels",
    );
    expect(parsed.searchParams.get("part")).toBe(
      "snippet,statistics,contentDetails",
    );
    expect(parsed.searchParams.get("key")).toBe("server-only-key");
    expect(client.getRequestCount()).toBe(1);
  });

  it("batches video metadata requests at the official 50-id limit", async () => {
    const fetchImplementation = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const ids = url.searchParams.get("id")?.split(",") ?? [];

      return Response.json({
        items: ids.map((id) => ({
          id,
          snippet: {
            channelId: "channel-1",
            title: `영상 ${id}`,
            description: "설명",
            publishedAt: "2026-08-25T00:00:00Z",
            thumbnails: {},
          },
          status: { privacyStatus: "public" },
        })),
      });
    });
    const client = createYouTubeDataApiClient({
      apiKey: "server-only-key",
      fetch: fetchImplementation,
    });
    const ids = Array.from({ length: 51 }, (_, index) => `video-${index + 1}`);

    const videos = await client.listVideos(ids);

    expect(videos).toHaveLength(51);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(client.getRequestCount()).toBe(2);
  });

  it("returns only video ids from an uploads-playlist page", async () => {
    const client = createYouTubeDataApiClient({
      apiKey: "server-only-key",
      fetch: vi.fn(async () =>
        Response.json({
          nextPageToken: "next-token",
          items: [
            { contentDetails: { videoId: "video-1" } },
            { contentDetails: { videoId: "video-1" } },
            { contentDetails: { videoId: "video-2" } },
          ],
        }),
      ),
    });

    await expect(client.listPlaylistPage("uploads-1")).resolves.toEqual({
      videoIds: ["video-1", "video-2"],
      nextPageToken: "next-token",
    });
  });

  it("fails closed on missing configuration or an upstream error", async () => {
    expect(
      () => createYouTubeDataApiClient({ apiKey: " " }),
    ).toThrowError(YouTubeDataApiError);

    const client = createYouTubeDataApiClient({
      apiKey: "server-only-key",
      fetch: vi.fn(async () => new Response(null, { status: 403 })),
    });

    await expect(client.listChannels(["channel-1"])).rejects.toMatchObject({
      kind: "unavailable",
      httpStatus: 403,
    });
  });
});
