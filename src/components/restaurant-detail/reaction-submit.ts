import type { ReactionKind } from "@/domain/types";

const moderationStatuses = [
  "private_only",
  "counted",
  "held",
  "rejected",
] as const;

export type SubmittedReaction = Readonly<{
  reactionId: string;
  kind: ReactionKind;
  moderationStatus: (typeof moderationStatuses)[number];
  wasCreated: boolean;
  wasChanged: boolean;
  savedAt: string;
}>;

type SubmitReactionInput = Readonly<{
  accessToken: string;
  restaurantId: string;
  kind: ReactionKind;
  visitProofToken?: string;
}>;

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const visitProofTokenPattern = /^[A-Za-z0-9_-]{32,128}$/;

function isReactionKind(value: unknown): value is ReactionKind {
  return value === "like" || value === "okay" || value === "dislike";
}

function isModerationStatus(
  value: unknown,
): value is SubmittedReaction["moderationStatus"] {
  return moderationStatuses.some((status) => status === value);
}

function parseSubmittedReaction(value: unknown): SubmittedReaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const reaction = (value as { reaction?: unknown }).reaction;
  if (!reaction || typeof reaction !== "object" || Array.isArray(reaction)) {
    return null;
  }

  const candidate = reaction as Record<string, unknown>;

  if (
    typeof candidate.reactionId !== "string" ||
    !uuidPattern.test(candidate.reactionId) ||
    !isReactionKind(candidate.kind) ||
    !isModerationStatus(candidate.moderationStatus) ||
    typeof candidate.wasCreated !== "boolean" ||
    typeof candidate.wasChanged !== "boolean" ||
    typeof candidate.savedAt !== "string" ||
    Number.isNaN(Date.parse(candidate.savedAt))
  ) {
    return null;
  }

  return {
    reactionId: candidate.reactionId,
    kind: candidate.kind,
    moderationStatus: candidate.moderationStatus,
    wasCreated: candidate.wasCreated,
    wasChanged: candidate.wasChanged,
    savedAt: candidate.savedAt,
  };
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getFailureMessage(status: number) {
  if (status === 401) return "로그인이 만료됐어요. 다시 로그인해 주세요.";
  if (status === 409) {
    return "방문 확인이 만료됐거나 이미 사용됐어요. 다시 체크인해 주세요.";
  }
  if (status === 404) return "반응을 남길 수 있는 식당을 찾지 못했어요.";
  if (status === 429) return "요청이 많아요. 잠시 후 다시 시도해 주세요.";
  return "서버에 저장하지 못했어요. 내 취향 선택은 이 기기에 남아 있습니다.";
}

export class ReactionSubmissionError extends Error {
  constructor(
    readonly status: number,
    message = getFailureMessage(status),
  ) {
    super(message);
    this.name = "ReactionSubmissionError";
  }
}

export async function submitAuthenticatedReaction(
  input: SubmitReactionInput,
  fetchImplementation: Fetch = fetch,
) {
  const accessToken = input.accessToken.trim();

  if (
    !accessToken ||
    !uuidPattern.test(input.restaurantId) ||
    (input.visitProofToken !== undefined &&
      !visitProofTokenPattern.test(input.visitProofToken))
  ) {
    throw new ReactionSubmissionError(400);
  }

  let response: Response;

  try {
    response = await fetchImplementation("/api/reactions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        restaurantId: input.restaurantId,
        kind: input.kind,
        ...(input.visitProofToken
          ? { visitProofToken: input.visitProofToken }
          : {}),
      }),
      cache: "no-store",
    });
  } catch {
    throw new ReactionSubmissionError(503);
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw new ReactionSubmissionError(response.status);
  }

  const reaction = parseSubmittedReaction(body);
  if (!reaction) throw new ReactionSubmissionError(503);

  return reaction;
}
