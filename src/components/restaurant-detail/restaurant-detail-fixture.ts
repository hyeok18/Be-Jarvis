import { CREATOR_EVIDENCE_FIXTURE, DOMAIN_FIXTURE } from "../../domain/fixtures";
import {
  calculateRestaurantMatch,
  selectPublishableCreatorEvidence,
  summarizeRestaurantReactions,
} from "../../domain/signals";

import type { CreatorVisitSource } from "../map/map-view-model";
import type { RestaurantDetailData } from "./restaurant-detail-view-model";
import { getReactionRestaurantId } from "./reaction-restaurant-map";

/** Temporary WU-15 detail provider until the public Supabase provider arrives. */
export function getFixtureRestaurantDetail(
  restaurantId: string,
): RestaurantDetailData | null {
  const restaurant = DOMAIN_FIXTURE.restaurants.find(
    (item) => item.id === restaurantId,
  );
  const restaurantProfile = DOMAIN_FIXTURE.restaurantProfiles.find(
    (item) => item.restaurantId === restaurantId,
  );

  if (!restaurant || !restaurantProfile) return null;

  const reactionSummary = summarizeRestaurantReactions(
    restaurantId,
    DOMAIN_FIXTURE.reactions,
  );
  const personalMatch = calculateRestaurantMatch({
    profile: DOMAIN_FIXTURE.userProfile,
    restaurant: restaurantProfile,
    ...(restaurantId === "restaurant-balanced-bowl"
      ? {
          similarUserEvidence: { fitPercent: 88, overlapCount: 7 },
          visitEvidence: { fitPercent: 90, sampleSize: 3 },
        }
      : {}),
  });
  const creatorVisitSources: CreatorVisitSource[] =
    selectPublishableCreatorEvidence(
      CREATOR_EVIDENCE_FIXTURE,
      DOMAIN_FIXTURE.now,
    )
      .filter((item) => item.evidence.restaurantId === restaurantId)
      .map((item) => ({
        restaurantId: item.evidence.restaurantId,
        videoId: item.video.youtubeVideoId,
        videoTitle: item.video.title,
        videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(item.video.youtubeVideoId)}`,
        channelTitle: item.channel.title,
        subscriberCount: item.channel.subscriberCount,
        hiddenSubscriberCount: item.channel.hiddenSubscriberCount,
        publishedAt: item.video.publishedAt,
        metadataFetchedAt: item.video.metadataFetchedAt,
      }));

  return {
    restaurant,
    reactionRestaurantId: getReactionRestaurantId(restaurant.id),
    reactionSummary,
    personalMatch,
    creatorVisitSources,
  };
}

export function getFixtureRestaurantIds(): readonly string[] {
  return DOMAIN_FIXTURE.restaurants.map((restaurant) => restaurant.id);
}
