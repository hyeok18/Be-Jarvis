export type PublicSubscriberCountState =
  | "known"
  | "hidden"
  | "stale"
  | "unavailable";

export interface PublicReactionSummaryDto {
  restaurantId: string;
  counts: {
    like: number;
    okay: number;
    dislike: number;
  };
  percentages: {
    like: number;
    okay: number;
    dislike: number;
  } | null;
  countedTotal: number;
  isForming: boolean;
  version: string;
  updatedAt: string | null;
}

export interface PublicLocalMatchProfileDto {
  profileVersion: string;
  axisProfile: {
    spicy: number;
    sweet: number;
    light: number;
    rich: number;
    value: number;
    cleanliness: number;
    service: number;
  };
  foodTags: readonly string[];
}

export interface PublicCreatorEvidenceDto {
  evidenceId: string;
  restaurantId: string;
  youtubeVideoId: string;
  videoTitle: string;
  videoUrl: string;
  videoTimestampSeconds: number | null;
  publishedAt: string;
  videoMetadataFetchedAt: string;
  lastVerifiedAt: string;
  channel: {
    youtubeChannelId: string;
    title: string;
    url: string;
    thumbnailUrl: string | null;
    subscriberCount: number | null;
    subscriberCountState: PublicSubscriberCountState;
    subscriberCountFetchedAt: string | null;
    metadataFetchedAt: string;
  };
}

export interface PublicRestaurantDto {
  id: string;
  kakaoPlaceId: string;
  name: string;
  categoryName: string;
  address: string;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  updatedAt: string;
  reactionSummary: PublicReactionSummaryDto;
  localMatchProfile: PublicLocalMatchProfileDto;
  creatorEvidence: readonly PublicCreatorEvidenceDto[];
}

export interface PublicRestaurantsMeta {
  source: "supabase";
  generatedAt: string;
  restaurantCount: number;
}

export interface PublicRestaurantListSuccess {
  ok: true;
  data: {
    restaurants: readonly PublicRestaurantDto[];
  };
  meta: PublicRestaurantsMeta;
}

export interface PublicRestaurantDetailSuccess {
  ok: true;
  data: {
    restaurant: PublicRestaurantDto;
  };
  meta: PublicRestaurantsMeta;
}

export type PublicRestaurantsErrorCode =
  | "PUBLIC_DATA_UNAVAILABLE"
  | "RESTAURANT_NOT_FOUND";

export interface PublicRestaurantsError {
  ok: false;
  error: {
    code: PublicRestaurantsErrorCode;
    message: string;
    retryable: boolean;
  };
}

export type PublicRestaurantListResponse =
  | PublicRestaurantListSuccess
  | PublicRestaurantsError;

export type PublicRestaurantDetailResponse =
  | PublicRestaurantDetailSuccess
  | PublicRestaurantsError;
