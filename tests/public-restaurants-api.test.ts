import { describe, expect, it, vi } from "vitest";

import type { PublicRestaurantDto } from "../src/contracts/public-restaurants";
import {
  createPublicRestaurantRepository,
  PublicRestaurantRepositoryError,
} from "../src/server/restaurants/public-restaurant-repository";
import {
  createPublicRestaurantDetailGetHandler,
  createPublicRestaurantListGetHandler,
} from "../src/server/restaurants/public-restaurants-api";

const NOW = new Date("2026-08-25T12:00:00.000Z");
const RESTAURANT_ID = "10000000-0000-4000-8000-000000000001";

const restaurantRow = {
  id: RESTAURANT_ID,
  kakao_place_id: "synthetic-seongsu-001",
  name: "합성 성수 한식 01",
  category_name: "한식",
  address_name: "서울 성동구 성수동 합성길 1",
  road_address_name: "서울 성동구 합성로 1길 1",
  latitude: 37.5431,
  longitude: 127.0501,
  food_tags: ["한식", "밥"],
  preference_profile: {
    profileVersion: "wu-04-v1",
    axisProfile: {
      spicy: 17,
      sweet: 23,
      light: 31,
      rich: 43,
      value: 47,
      cleanliness: 67,
      service: 66,
    },
  },
  updated_at: "2026-08-25T09:00:00.000Z",
};

const summaryRow = {
  restaurant_id: RESTAURANT_ID,
  like_count: 5,
  okay_count: 3,
  dislike_count: 1,
  counted_total: 9,
  version: 2,
  updated_at: "2026-08-25T11:00:00.000Z",
};

const evidenceRows = [
  {
    id: "70000000-0000-4000-8000-000000000001",
    creator_video_id: "60000000-0000-4000-8000-000000000001",
    restaurant_id: RESTAURANT_ID,
    status: "confirmed",
    video_timestamp_seconds: 95,
    confirmed_at: "2026-08-24T12:00:00.000Z",
    last_verified_at: "2026-08-25T10:00:00.000Z",
  },
  {
    id: "70000000-0000-4000-8000-000000000002",
    creator_video_id: "60000000-0000-4000-8000-000000000002",
    restaurant_id: RESTAURANT_ID,
    status: "confirmed",
    video_timestamp_seconds: null,
    confirmed_at: "2026-08-24T12:00:00.000Z",
    last_verified_at: "2026-08-25T10:00:00.000Z",
  },
  {
    id: "70000000-0000-4000-8000-000000000003",
    creator_video_id: "60000000-0000-4000-8000-000000000003",
    restaurant_id: RESTAURANT_ID,
    status: "candidate",
    video_timestamp_seconds: 30,
    confirmed_at: null,
    last_verified_at: null,
  },
  {
    id: "70000000-0000-4000-8000-000000000004",
    creator_video_id: "60000000-0000-4000-8000-000000000004",
    restaurant_id: RESTAURANT_ID,
    status: "stale",
    video_timestamp_seconds: 30,
    confirmed_at: null,
    last_verified_at: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "70000000-0000-4000-8000-000000000005",
    creator_video_id: "60000000-0000-4000-8000-000000000005",
    restaurant_id: RESTAURANT_ID,
    status: "confirmed",
    video_timestamp_seconds: null,
    confirmed_at: "2026-08-24T12:00:00.000Z",
    last_verified_at: "2026-08-25T10:00:00.000Z",
  },
  {
    id: "70000000-0000-4000-8000-000000000006",
    creator_video_id: "60000000-0000-4000-8000-000000000006",
    restaurant_id: RESTAURANT_ID,
    status: "confirmed",
    video_timestamp_seconds: null,
    confirmed_at: "2026-08-24T12:00:00.000Z",
    last_verified_at: "2026-08-25T10:00:00.000Z",
  },
];

const videoRows = [
  {
    id: "60000000-0000-4000-8000-000000000001",
    youtube_video_id: "public-video-known",
    creator_channel_id: "50000000-0000-4000-8000-000000000001",
    title: "공개 영상 A",
    published_at: "2026-08-20T12:00:00.000Z",
    privacy_status: "public",
    metadata_fetched_at: "2026-08-25T10:00:00.000Z",
    is_active: true,
  },
  {
    id: "60000000-0000-4000-8000-000000000002",
    youtube_video_id: "public-video-hidden",
    creator_channel_id: "50000000-0000-4000-8000-000000000002",
    title: "공개 영상 B",
    published_at: "2026-08-21T12:00:00.000Z",
    privacy_status: "public",
    metadata_fetched_at: "2026-08-25T10:00:00.000Z",
    is_active: true,
  },
  {
    id: "60000000-0000-4000-8000-000000000005",
    youtube_video_id: "private-video",
    creator_channel_id: "50000000-0000-4000-8000-000000000001",
    title: "비공개 영상",
    published_at: "2026-08-22T12:00:00.000Z",
    privacy_status: "private",
    metadata_fetched_at: "2026-08-25T10:00:00.000Z",
    is_active: true,
  },
  {
    id: "60000000-0000-4000-8000-000000000006",
    youtube_video_id: "public-video-stale-subscriber",
    creator_channel_id: "50000000-0000-4000-8000-000000000003",
    title: "공개 영상 C",
    published_at: "2026-08-22T12:00:00.000Z",
    privacy_status: "public",
    metadata_fetched_at: "2026-08-25T10:00:00.000Z",
    is_active: true,
  },
];

const channelRows = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    youtube_channel_id: "channel-known",
    title: "구독자 공개 채널",
    thumbnail_url: null,
    subscriber_count: 1_250_000,
    subscriber_count_hidden: false,
    subscriber_count_fetched_at: "2026-08-25T10:00:00.000Z",
    metadata_fetched_at: "2026-08-25T10:00:00.000Z",
    is_allowlisted: true,
    is_active: true,
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    youtube_channel_id: "channel-hidden",
    title: "구독자 비공개 채널",
    thumbnail_url: null,
    subscriber_count: null,
    subscriber_count_hidden: true,
    subscriber_count_fetched_at: "2026-08-25T10:00:00.000Z",
    metadata_fetched_at: "2026-08-25T10:00:00.000Z",
    is_allowlisted: true,
    is_active: true,
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    youtube_channel_id: "channel-stale-subscriber",
    title: "구독자 갱신 필요 채널",
    thumbnail_url: null,
    subscriber_count: 85_000,
    subscriber_count_hidden: false,
    subscriber_count_fetched_at: "2026-07-01T10:00:00.000Z",
    metadata_fetched_at: "2026-08-25T10:00:00.000Z",
    is_allowlisted: true,
    is_active: true,
  },
];

function createSupabaseFetch(
  options: { empty?: boolean; fail?: boolean; missingSummary?: boolean } = {},
) {
  const requests: URL[] = [];
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url);

    if (options.fail) {
      return Response.json({ message: "database unavailable" }, { status: 503 });
    }
    if (url.pathname.endsWith("/restaurants")) {
      return Response.json(options.empty ? [] : [restaurantRow]);
    }
    if (url.pathname.endsWith("/restaurant_reaction_summaries")) {
      return Response.json(options.missingSummary ? [] : [summaryRow]);
    }
    if (url.pathname.endsWith("/creator_visit_evidence")) {
      return Response.json(evidenceRows);
    }
    if (url.pathname.endsWith("/creator_videos")) {
      return Response.json(videoRows);
    }
    if (url.pathname.endsWith("/creator_channels")) {
      return Response.json(channelRows);
    }

    return Response.json({ message: "unexpected table" }, { status: 500 });
  });

  return { fetch, requests };
}

function createRepository(fetch: typeof globalThis.fetch) {
  return createPublicRestaurantRepository(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
      SUPABASE_SECRET_KEY: "server-secret-for-test",
    },
    { fetch, now: () => NOW },
  );
}

function minimalRestaurant(): PublicRestaurantDto {
  return {
    id: RESTAURANT_ID,
    kakaoPlaceId: "place-1",
    name: "식당",
    categoryName: "한식",
    address: "서울 성동구",
    roadAddress: null,
    latitude: 37.5,
    longitude: 127,
    updatedAt: NOW.toISOString(),
    reactionSummary: {
      restaurantId: RESTAURANT_ID,
      counts: { like: 0, okay: 0, dislike: 0 },
      percentages: null,
      countedTotal: 0,
      isForming: true,
      version: "0",
      updatedAt: null,
    },
    localMatchProfile: {
      profileVersion: "v1",
      axisProfile: {
        spicy: 50,
        sweet: 50,
        light: 50,
        rich: 50,
        value: 50,
        cleanliness: 50,
        service: 50,
      },
      foodTags: [],
    },
    creatorEvidence: [],
  };
}

describe("Supabase public restaurant repository", () => {
  it("returns counted projection and confirmed fresh public YouTube evidence only", async () => {
    const transport = createSupabaseFetch();
    const restaurants = await createRepository(transport.fetch).list();

    expect(restaurants).toHaveLength(1);
    expect(restaurants[0].reactionSummary).toEqual({
      restaurantId: RESTAURANT_ID,
      counts: { like: 5, okay: 3, dislike: 1 },
      percentages: { like: 55.56, okay: 33.33, dislike: 11.11 },
      countedTotal: 9,
      isForming: true,
      version: "2",
      updatedAt: "2026-08-25T11:00:00.000Z",
    });
    expect(restaurants[0].creatorEvidence).toHaveLength(3);
    expect(restaurants[0].creatorEvidence.map((item) => item.youtubeVideoId)).toEqual([
      "public-video-known",
      "public-video-stale-subscriber",
      "public-video-hidden",
    ]);
    expect(restaurants[0].creatorEvidence[0].videoUrl).toContain(
      "youtube.com/watch?v=public-video-known&t=95s",
    );
    expect(restaurants[0].creatorEvidence[0].channel).toMatchObject({
      subscriberCount: 1_250_000,
      subscriberCountState: "known",
      subscriberCountFetchedAt: "2026-08-25T10:00:00.000Z",
    });
    expect(restaurants[0].creatorEvidence[1].channel).toMatchObject({
      subscriberCount: null,
      subscriberCountState: "stale",
      subscriberCountFetchedAt: "2026-07-01T10:00:00.000Z",
    });
    expect(restaurants[0].creatorEvidence[2].channel).toMatchObject({
      subscriberCount: null,
      subscriberCountState: "hidden",
    });

    const requestedTables = transport.requests.map((url) => url.pathname);
    expect(requestedTables).not.toContain("/rest/v1/restaurant_reactions");
    expect(requestedTables).not.toContain("/rest/v1/reaction_events");
    expect(requestedTables).not.toContain("/rest/v1/visit_proofs");
    expect(transport.requests.find((url) => url.pathname.endsWith("creator_visit_evidence"))?.searchParams.get("status")).toBe(
      "eq.confirmed",
    );
    expect(transport.requests.find((url) => url.pathname.endsWith("creator_videos"))?.searchParams.get("privacy_status")).toBe(
      "eq.public",
    );
  });

  it("does not serialize held/private reactions, audit data, proof, or admin candidate fields", async () => {
    const transport = createSupabaseFetch();
    const serialized = JSON.stringify(await createRepository(transport.fetch).list());

    for (const forbidden of [
      "private_only",
      "held",
      "risk_codes",
      "moderation_status",
      "reaction_events",
      "visit_proof",
      "confirmed_by",
      "confirmation_note",
      "candidate",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("returns a successful empty collection when the active restaurant query is empty", async () => {
    const transport = createSupabaseFetch({ empty: true });

    await expect(createRepository(transport.fetch).list()).resolves.toEqual([]);
    expect(transport.requests).toHaveLength(1);
  });

  it("fails closed when Supabase returns an error", async () => {
    const transport = createSupabaseFetch({ fail: true });

    await expect(createRepository(transport.fetch).list()).rejects.toEqual(
      expect.objectContaining<Partial<PublicRestaurantRepositoryError>>({
        name: "PublicRestaurantRepositoryError",
        kind: "unavailable",
        httpStatus: 503,
      }),
    );
  });

  it("fails closed instead of fabricating a zero summary when projection data is missing", async () => {
    const transport = createSupabaseFetch({ missingSummary: true });

    await expect(createRepository(transport.fetch).list()).rejects.toEqual(
      expect.objectContaining<Partial<PublicRestaurantRepositoryError>>({
        name: "PublicRestaurantRepositoryError",
        kind: "invalid_response",
      }),
    );
  });
});

describe("public restaurant API contract", () => {
  it("allows an unauthenticated list request and reports the real result count", async () => {
    const restaurant = minimalRestaurant();
    const handler = createPublicRestaurantListGetHandler({
      repository: {
        list: async () => [restaurant],
        getById: async () => restaurant,
      },
      now: () => NOW,
    });

    const response = await handler();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { restaurants: [restaurant] },
      meta: {
        source: "supabase",
        generatedAt: NOW.toISOString(),
        restaurantCount: 1,
      },
    });
  });

  it("keeps an empty result distinct from a database failure", async () => {
    const emptyHandler = createPublicRestaurantListGetHandler({
      repository: {
        list: async () => [],
        getById: async () => null,
      },
      now: () => NOW,
    });
    const failureHandler = createPublicRestaurantListGetHandler({
      repository: {
        list: async () => {
          throw new Error("database failed");
        },
        getById: async () => null,
      },
    });

    const emptyResponse = await emptyHandler();
    expect(emptyResponse.status).toBe(200);
    await expect(emptyResponse.json()).resolves.toMatchObject({
      ok: true,
      data: { restaurants: [] },
      meta: { restaurantCount: 0 },
    });

    const failureResponse = await failureHandler();
    expect(failureResponse.status).toBe(503);
    const failureBody = await failureResponse.json();
    expect(failureBody).toEqual({
      ok: false,
      error: {
        code: "PUBLIC_DATA_UNAVAILABLE",
        message: "식당 데이터를 잠시 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
        retryable: true,
      },
    });
    expect(failureBody).not.toHaveProperty("data");
  });

  it("returns detail data and a non-retryable not-found contract", async () => {
    const restaurant = minimalRestaurant();
    const repository = {
      list: async () => [restaurant],
      getById: async (id: string) => (id === RESTAURANT_ID ? restaurant : null),
    };
    const handler = createPublicRestaurantDetailGetHandler({
      repository,
      now: () => NOW,
    });

    const response = await handler(new Request("https://example.test"), {
      params: Promise.resolve({ id: RESTAURANT_ID }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { restaurant },
      meta: { restaurantCount: 1 },
    });

    const missing = await handler(new Request("https://example.test"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "RESTAURANT_NOT_FOUND",
        message: "요청한 식당을 찾을 수 없습니다.",
        retryable: false,
      },
    });
  });
});
