import { CREATOR_EVIDENCE_FIXTURE, DOMAIN_FIXTURE } from "../../domain/fixtures";
import {
  calculateRestaurantMatch,
  selectPublishableCreatorEvidence,
  summarizeRestaurantReactions,
} from "../../domain/signals";

import type { MapExplorerData } from "./map-explorer-data";

/**
 * Temporary presentation data for the public-map shell.
 *
 * The actual WU-15 Supabase provider will replace this module at the page
 * boundary without making MapExplorer aware of raw reactions, visit proofs,
 * moderation states, or unconfirmed creator candidates.
 */
export function getFixtureMapExplorerData(): MapExplorerData {
  const reactionSummaries = DOMAIN_FIXTURE.restaurants.map((restaurant) =>
    summarizeRestaurantReactions(restaurant.id, DOMAIN_FIXTURE.reactions),
  );
  const personalMatches = DOMAIN_FIXTURE.restaurantProfiles.map(
    (restaurantProfile) =>
      calculateRestaurantMatch({
        profile: DOMAIN_FIXTURE.userProfile,
        restaurant: restaurantProfile,
        ...(restaurantProfile.restaurantId === "restaurant-balanced-bowl"
          ? {
              similarUserEvidence: { fitPercent: 88, overlapCount: 7 },
              visitEvidence: { fitPercent: 90, sampleSize: 3 },
            }
          : {}),
      }),
  );
  const publishableCreatorEvidence = selectPublishableCreatorEvidence(
    CREATOR_EVIDENCE_FIXTURE,
    DOMAIN_FIXTURE.now,
  );

  return {
    restaurants: DOMAIN_FIXTURE.restaurants,
    reactionSummaries,
    personalMatches,
    creatorVisitSources: publishableCreatorEvidence.map((item) => ({
      restaurantId: item.evidence.restaurantId,
      videoId: item.video.youtubeVideoId,
      videoTitle: item.video.title,
      videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(item.video.youtubeVideoId)}`,
      channelTitle: item.channel.title,
      subscriberCount: item.channel.subscriberCount,
      hiddenSubscriberCount: item.channel.hiddenSubscriberCount,
      publishedAt: item.video.publishedAt,
      metadataFetchedAt: item.video.metadataFetchedAt,
    })),
  };
}
