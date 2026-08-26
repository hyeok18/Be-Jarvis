import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getKakaoPlaceHref } from "../src/components/map/kakao-place-link";
import { PublicDataUnavailable } from "../src/components/public-data/public-data-unavailable";
import {
  toMapExplorerData,
  toRestaurantDetailData,
} from "../src/components/public-data/public-restaurant-ui-adapter";
import type { PublicRestaurantDto } from "../src/contracts/public-restaurants";

const restaurant: PublicRestaurantDto = {
  id: "10000000-0000-4000-8000-000000000001",
  kakaoPlaceId: "57374817",
  name: "통합 테스트 식당",
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
  it("keeps the public projection separate and preserves the actual UUID", () => {
    const data = toMapExplorerData([restaurant]);
    const detail = toRestaurantDetailData(restaurant);

    expect(data.reactionSummaries[0]).toEqual(restaurant.reactionSummary);
    expect(data.personalMatches[0]).toMatchObject({
      restaurantId: restaurant.id,
      status: "needs_preferences",
      matchPercent: null,
    });
    expect(detail.reactionRestaurantId).toBe(restaurant.id);
    expect(detail.creatorVisitSources[0]).toMatchObject({
      videoId: "video-1",
      subscriberCount: null,
    });
  });

  it("uses a canonical place URL for numeric Kakao IDs and map fallback otherwise", () => {
    expect(getKakaoPlaceHref(toRestaurantDetailData(restaurant).restaurant)).toBe(
      "https://place.map.kakao.com/57374817",
    );
    expect(
      getKakaoPlaceHref({
        ...toRestaurantDetailData(restaurant).restaurant,
        kakaoPlaceId: "synthetic-place-001",
      }),
    ).toContain("https://map.kakao.com/link/map/");
  });

  it("keeps an explicit data failure and snapshot path instead of fabricating data", () => {
    const markup = renderToStaticMarkup(
      createElement(PublicDataUnavailable, {
        retryHref: "/",
        snapshotHref: "/?snapshot=1",
      }),
    );

    expect(markup).toContain("PUBLIC_DATA_UNAVAILABLE");
    expect(markup).toContain("/?snapshot=1");
    expect(markup).toContain("0건으로 바꾸거나 임의 데이터로 대체하지 않았습니다");
  });
});
