export type CreatorEvidenceStatus =
  | "candidate"
  | "confirmed"
  | "rejected"
  | "stale";

export type CreatorEvidenceCandidate = {
  id: string;
  status: CreatorEvidenceStatus;
  videoTimestampSeconds: number | null;
  confirmationNote: string | null;
  confirmedAt: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  video: {
    id: string;
    youtubeVideoId: string;
    title: string;
    publishedAt: string;
    privacyStatus: string;
    isActive: boolean;
    originalUrl: string;
    channel: {
      id: string;
      title: string;
      youtubeChannelId: string;
    };
  };
  restaurant: {
    id: string;
    name: string;
    addressName: string;
    roadAddressName: string | null;
    kakaoPlaceId: string;
    isActive: boolean;
  };
};

export type YouTubeSyncRun = {
  id: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  triggerKind: "manual" | "cron";
  apiRequestCount: number;
  processedVideoCount: number;
  candidateCount: number;
  errorSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
};
