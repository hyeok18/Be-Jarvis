import type { PublicRestaurantDto } from "../../contracts/public-restaurants";
import { calculateRestaurantMatch } from "../../domain/signals";
import type {
  Restaurant,
  RestaurantPreferenceProfile,
  UserPreferenceProfile,
} from "../../domain/types";

import type { MapExplorerData } from "../map/map-explorer-data";
import type { CreatorVisitSource } from "../map/map-view-model";
import type { RestaurantDetailData } from "../restaurant-detail/restaurant-detail-view-model";

const EMPTY_LOCAL_PREFERENCE_PROFILE: UserPreferenceProfile = {
  profileVersion: "local-preferences-unset",
  axisPreferences: {},
  excludedFoodTags: [],
  onboardingSources: [],
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function toRestaurant(value: PublicRestaurantDto): Restaurant {
  return {
    id: value.id,
    kakaoPlaceId: value.kakaoPlaceId,
    name: value.name,
    categoryGroupCode: null,
    categoryName: value.categoryName,
    roadAddress: value.roadAddress,
    address: value.address,
    latitude: value.latitude,
    longitude: value.longitude,
    region: "성수동",
    createdAt: value.updatedAt,
  };
}

function toPreferenceProfile(value: PublicRestaurantDto): RestaurantPreferenceProfile {
  return {
    restaurantId: value.id,
    axisProfile: value.localMatchProfile.axisProfile,
    foodTags: value.localMatchProfile.foodTags,
  };
}

function toCreatorVisitSources(
  value: PublicRestaurantDto,
): readonly CreatorVisitSource[] {
  return value.creatorEvidence.map((evidence) => ({
    restaurantId: evidence.restaurantId,
    videoId: evidence.youtubeVideoId,
    videoTitle: evidence.videoTitle,
    videoUrl: evidence.videoUrl,
    channelTitle: evidence.channel.title,
    subscriberCount: evidence.channel.subscriberCount,
    subscriberCountState: evidence.channel.subscriberCountState,
    hiddenSubscriberCount: evidence.channel.subscriberCountState === "hidden",
    publishedAt: evidence.publishedAt,
    metadataFetchedAt: evidence.videoMetadataFetchedAt,
  }));
}

function toPersonalMatch(value: PublicRestaurantDto) {
  return calculateRestaurantMatch({
    profile: EMPTY_LOCAL_PREFERENCE_PROFILE,
    restaurant: toPreferenceProfile(value),
  });
}

export function toMapExplorerData(
  restaurants: readonly PublicRestaurantDto[],
): MapExplorerData {
  return {
    restaurants: restaurants.map(toRestaurant),
    reactionSummaries: restaurants.map((restaurant) => restaurant.reactionSummary),
    personalMatches: restaurants.map(toPersonalMatch),
    creatorVisitSources: restaurants.flatMap(toCreatorVisitSources),
  };
}

export function toRestaurantDetailData(
  value: PublicRestaurantDto,
): RestaurantDetailData {
  return {
    restaurant: toRestaurant(value),
    reactionRestaurantId: value.id,
    reactionSummary: value.reactionSummary,
    personalMatch: toPersonalMatch(value),
    creatorVisitSources: toCreatorVisitSources(value),
  };
}
