import { describe, expect, it, vi } from "vitest";

import {
  CreatorAdminRepositoryError,
  createCreatorAdminRepository,
} from "../src/server/youtube/creator-admin-repository";

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_server-only-test",
};
const evidenceId = "10000000-0000-4000-8000-000000000001";
const adminId = "20000000-0000-4000-8000-000000000001";

const candidateRow = {
  id: evidenceId,
  status: "candidate",
  video_timestamp_seconds: null,
  confirmation_note: null,
  confirmed_at: null,
  last_verified_at: null,
  created_at: "2026-08-25T09:00:00.000Z",
  updated_at: "2026-08-25T09:00:00.000Z",
  creator_video: {
    id: "30000000-0000-4000-8000-000000000001",
    youtube_video_id: "youtube-video-id",
    title: "식당 방문 영상",
    published_at: "2026-08-20T09:00:00.000Z",
    privacy_status: "public",
    is_active: true,
    creator_channel: {
      id: "40000000-0000-4000-8000-000000000001",
      title: "맛있는 채널",
      youtube_channel_id: "youtube-channel-id",
    },
  },
  restaurant: {
    id: "50000000-0000-4000-8000-000000000001",
    name: "확인 식당",
    address_name: "서울시 중구",
    road_address_name: null,
    kakao_place_id: "kakao-place-id",
    is_active: true,
  },
};

describe("creator admin repository", () => {
  it("maps candidates and creates the official original-video URL", async () => {
    const repository = createCreatorAdminRepository(
      environment,
      vi.fn(async () => Response.json([candidateRow])),
    );

    await expect(repository.listEvidence()).resolves.toMatchObject([
      {
        id: evidenceId,
        status: "candidate",
        video: {
          originalUrl: "https://www.youtube.com/watch?v=youtube-video-id",
          channel: { title: "맛있는 채널" },
        },
        restaurant: { name: "확인 식당", kakaoPlaceId: "kakao-place-id" },
      },
    ]);
  });

  it("confirms only an active public candidate using an optimistic status filter", async () => {
    const fetchImplementation = vi
      .fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json([candidateRow]))
      .mockResolvedValueOnce(Response.json([{ id: evidenceId }]));
    const repository = createCreatorAdminRepository(environment, fetchImplementation);

    await repository.confirmEvidence({
      evidenceId,
      adminUserId: adminId,
      confirmationNote: "영상 42초에서 상호 확인",
      videoTimestampSeconds: 42,
      decidedAt: "2026-08-25T10:00:00.000Z",
    });

    const [url, init] = fetchImplementation.mock.calls[1];
    expect(String(url)).toContain(`id=eq.${evidenceId}`);
    expect(String(url)).toContain("status=eq.candidate");
    expect(init?.headers).toMatchObject({
      apikey: "sb_secret_server-only-test",
      Prefer: "return=representation",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      status: "confirmed",
      confirmed_by: adminId,
      confirmed_at: "2026-08-25T10:00:00.000Z",
      last_verified_at: "2026-08-25T10:00:00.000Z",
      confirmation_note: "영상 42초에서 상호 확인",
      video_timestamp_seconds: 42,
    });
  });

  it("refuses stale, private, inactive, and already-decided evidence", async () => {
    for (const row of [
      { ...candidateRow, status: "confirmed" },
      {
        ...candidateRow,
        creator_video: { ...candidateRow.creator_video, privacy_status: "private" },
      },
      {
        ...candidateRow,
        creator_video: { ...candidateRow.creator_video, is_active: false },
      },
      {
        ...candidateRow,
        restaurant: { ...candidateRow.restaurant, is_active: false },
      },
    ]) {
      const repository = createCreatorAdminRepository(
        environment,
        vi.fn(async () => Response.json([row])),
      );

      await expect(
        repository.confirmEvidence({
          evidenceId,
          adminUserId: adminId,
          confirmationNote: null,
          videoTimestampSeconds: null,
          decidedAt: "2026-08-25T10:00:00.000Z",
        }),
      ).rejects.toBeInstanceOf(CreatorAdminRepositoryError);
    }
  });

  it("treats an empty conditional update as a concurrent decision conflict", async () => {
    const fetchImplementation = vi
      .fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json([candidateRow]))
      .mockResolvedValueOnce(Response.json([]));
    const repository = createCreatorAdminRepository(environment, fetchImplementation);

    await expect(
      repository.rejectEvidence({ evidenceId, confirmationNote: null }),
    ).rejects.toMatchObject({ kind: "conflict" });
  });
});
