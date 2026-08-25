export interface CreatorVisitSource {
  restaurantId: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  channelTitle: string;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  publishedAt: string;
  metadataFetchedAt: string;
}
