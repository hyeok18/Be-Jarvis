import { describe, expect, it } from "vitest";

import type { PublicRestaurantDto } from "../src/contracts/public-restaurants";
import {
  toMapExplorerData,
  toRestaurantDetailData,
} from "../src/components/public-data/public-restaurant-ui-adapter";

const restaurant: PublicRestaurantDto = {
  id: "10000000-0000-4000-8000-000000000001",
  kakaoPlaceId: "place-1",
  name: "실제 연결 식당",
  categoryName: "한식",
  address: "서울 성동구 성수동",
  roadAddress: null,
  latitude: 37.54,
  longitude: 127.05,
  updatedAt: "2026-08-26T00:00:00.000Z",
  reactionSummary: {
    restaurantId: "10000000-0000-4000-8000-000000000001",
    counts: { like: 2, okay: 1, dislike: 0 },
    percentages: { like: 66.67, okay: 33.33, dislike: 0 },
    countedTotal: 3,
    isForming: true,
    version: "2",
    updatedAt: "2026-08-26T00:00:00.000Z",
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
    foodTags: ["rice"],
  },
  creatorEvidence: [
    {
      evidenceId: "evidence-1",
      restaurantId: "10000000-0000-4000-8000-000000000001",
      youtubeVideoId: "video-1",
      videoTitle: "확인된 영상",
      videoUrl: "https://www.youtube.com/watch?v=video-1",
      videoTimestampSeconds: null,
      publishedAt: "2026-08-25T00:00:00.000Z",
      videoMetadataFetchedAt: "2026-08-26T00:00:00.000Z",
      lastVerifiedAt: "2026-08-26T00:00:00.000Z",
      channel: {
        youtubeChannelId: "channel-1",
        title: "갱신 필요 채널",
        url: "https://www.youtube.com/channel/channel-1",
        thumbnailUrl: null,
        subscriberCount: null,
        subscriberCountState: "stale",
        subscriberCountFetchedAt: "2026-07-01T00:00:00.000Z",
        metadataFetchedAt: "2026-08-26T00:00:00.000Z",
      },
    },
  ],
};

describe("public restaurant UI adapter", () => {
  it("keeps the public projection separate and does not invent a personal match", () => {
    const data = toMapExplorerData([restaurant]);

    expect(data.reactionSummaries[0]).toEqual(restaurant.reactionSummary);
    expect(data.personalMatches[0]).toMatchObject({
      restaurantId: restaurant.id,
      status: "needs_preferences",
      matchPercent: null,
    });
    expect(data.creatorVisitSources[0]).toMatchObject({
      videoId: "video-1",
      subscriberCount: null,
      subscriberCountState: "stale",
    });
  });

  it("uses the real restaurant UUID for authenticated reactions and check-ins", () => {
    const detail = toRestaurantDetailData(restaurant);

    expect(detail.reactionRestaurantId).toBe(restaurant.id);
    expect(detail.restaurant.name).toBe("실제 연결 식당");
  });
});
