import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MapFallback } from "../src/components/map/map-fallback";
import { DOMAIN_FIXTURE } from "../src/domain/fixtures";

describe("MapFallback", () => {
  it("keeps restaurant addresses and Kakao Map links available", () => {
    const [selectedRestaurant] = DOMAIN_FIXTURE.restaurants;
    const markup = renderToStaticMarkup(
      createElement(MapFallback, {
        reason: "지도 SDK를 사용할 수 없습니다.",
        restaurants: DOMAIN_FIXTURE.restaurants,
        creatorVisitSources: [
          {
            restaurantId: selectedRestaurant.id,
            videoId: "synthetic-video",
            videoTitle: "합성 방문 영상",
            videoUrl: "https://www.youtube.com/watch?v=synthetic-video",
            channelTitle: "합성 채널",
            subscriberCount: 120_000,
            hiddenSubscriberCount: false,
            publishedAt: "2026-08-22T00:00:00.000Z",
            metadataFetchedAt: "2026-08-24T00:00:00.000Z",
          },
        ],
        selectedRestaurantId: selectedRestaurant.id,
        onSelectRestaurant: () => undefined,
      }),
    );

    expect(markup).toContain("지도를 불러오지 못했어요");
    expect(markup).toContain("지도 SDK를 사용할 수 없습니다.");
    expect(markup).toContain(selectedRestaurant.name);
    expect(markup).toContain(selectedRestaurant.roadAddress);
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("https://map.kakao.com/link/map/");
    expect(markup).toContain(
      "https://www.youtube.com/watch?v=synthetic-video",
    );
    expect(markup).toContain("YouTube 원본 보기");
  });
});
