import type { AdminAuthDependencies } from "./admin-auth";
import { requireAdminUser } from "./admin-session";
import {
  CreatorAdminRepositoryError,
  type CreatorAdminRepository,
} from "../youtube/creator-admin-repository";
import type { YouTubeSyncResult } from "../youtube/youtube-sync";

type AdminApiDependencies = {
  auth: Pick<AdminAuthDependencies, "verifyAdminAccessToken">;
  repository: CreatorAdminRepository;
  runSync: () => Promise<YouTubeSyncResult>;
  now?: () => Date;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(status: number, code: string, message: string) {
  return jsonResponse({ error: { code, message } }, status);
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readDecisionInput(request: Request) {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const allowedKeys = ["confirmationNote", "videoTimestampSeconds"];
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) return null;

  const confirmationNote = record.confirmationNote ?? null;
  const videoTimestampSeconds = record.videoTimestampSeconds ?? null;

  if (
    (confirmationNote !== null &&
      (typeof confirmationNote !== "string" || confirmationNote.length > 1000)) ||
    (videoTimestampSeconds !== null &&
      (!Number.isInteger(videoTimestampSeconds) ||
        Number(videoTimestampSeconds) < 0 ||
        Number(videoTimestampSeconds) > 86_400))
  ) {
    return null;
  }

  return {
    confirmationNote:
      typeof confirmationNote === "string" && confirmationNote.trim()
        ? confirmationNote.trim()
        : null,
    videoTimestampSeconds:
      videoTimestampSeconds === null ? null : Number(videoTimestampSeconds),
  };
}

async function authorize(
  request: Request,
  dependencies: AdminApiDependencies,
) {
  try {
    return await requireAdminUser(request, dependencies.auth);
  } catch {
    return "unavailable" as const;
  }
}

function repositoryErrorResponse(error: unknown) {
  if (error instanceof CreatorAdminRepositoryError) {
    if (error.kind === "not_found") {
      return errorResponse(404, "EVIDENCE_NOT_FOUND", "방문 후보를 찾지 못했습니다.");
    }
    if (error.kind === "conflict") {
      return errorResponse(409, "ALREADY_DECIDED", "이미 처리된 방문 후보입니다.");
    }
    if (error.kind === "not_confirmable") {
      return errorResponse(
        409,
        "NOT_CONFIRMABLE",
        "비공개·삭제 영상 또는 비활성 식당은 확정할 수 없습니다.",
      );
    }
    if (error.kind === "configuration") {
      return errorResponse(
        503,
        "SERVICE_NOT_CONFIGURED",
        "관리자 데이터 서비스가 아직 설정되지 않았습니다.",
      );
    }
  }

  return errorResponse(
    503,
    "ADMIN_DATA_UNAVAILABLE",
    "관리자 데이터를 잠시 사용할 수 없습니다.",
  );
}

async function requireAuthorizedResponse(
  request: Request,
  dependencies: AdminApiDependencies,
) {
  const user = await authorize(request, dependencies);
  if (user === "unavailable") {
    return {
      response: errorResponse(
        503,
        "AUTH_UNAVAILABLE",
        "관리자 인증을 잠시 확인할 수 없습니다.",
      ),
      user: null,
    };
  }
  if (!user) {
    return {
      response: errorResponse(401, "ADMIN_AUTH_REQUIRED", "관리자 로그인이 필요합니다."),
      user: null,
    };
  }
  return { response: null, user };
}

export function createCreatorEvidenceGetHandler(dependencies: AdminApiDependencies) {
  return async function GET(request: Request) {
    const authorization = await requireAuthorizedResponse(request, dependencies);
    if (authorization.response) return authorization.response;

    try {
      return jsonResponse({ evidence: await dependencies.repository.listEvidence() });
    } catch (error) {
      return repositoryErrorResponse(error);
    }
  };
}

export function createSyncRunsGetHandler(dependencies: AdminApiDependencies) {
  return async function GET(request: Request) {
    const authorization = await requireAuthorizedResponse(request, dependencies);
    if (authorization.response) return authorization.response;

    try {
      return jsonResponse({ runs: await dependencies.repository.listSyncRuns() });
    } catch (error) {
      return repositoryErrorResponse(error);
    }
  };
}

export function createManualSyncPostHandler(dependencies: AdminApiDependencies) {
  return async function POST(request: Request) {
    if (!isSameOrigin(request)) {
      return errorResponse(403, "ORIGIN_REJECTED", "요청 출처를 확인할 수 없습니다.");
    }

    const authorization = await requireAuthorizedResponse(request, dependencies);
    if (authorization.response) return authorization.response;

    try {
      return jsonResponse({ run: await dependencies.runSync() }, 202);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "kind" in error &&
        error.kind === "already_running"
      ) {
        return errorResponse(409, "SYNC_ALREADY_RUNNING", "동기화가 이미 실행 중입니다.");
      }

      return errorResponse(
        503,
        "SYNC_UNAVAILABLE",
        "YouTube 동기화를 시작하지 못했습니다.",
      );
    }
  };
}

export function createEvidenceDecisionPostHandler(
  dependencies: AdminApiDependencies,
  decision: "confirm" | "reject",
) {
  return async function POST(request: Request, context: RouteContext) {
    if (!isSameOrigin(request)) {
      return errorResponse(403, "ORIGIN_REJECTED", "요청 출처를 확인할 수 없습니다.");
    }

    const authorization = await requireAuthorizedResponse(request, dependencies);
    if (authorization.response || !authorization.user) return authorization.response!;

    const { id } = await context.params;
    if (!uuidPattern.test(id)) {
      return errorResponse(400, "INVALID_EVIDENCE_ID", "방문 후보 ID가 올바르지 않습니다.");
    }

    const input = await readDecisionInput(request);
    if (!input) {
      return errorResponse(400, "INVALID_REQUEST", "확인 메모와 영상 시간을 확인해 주세요.");
    }

    try {
      if (decision === "confirm") {
        await dependencies.repository.confirmEvidence({
          evidenceId: id,
          adminUserId: authorization.user.id,
          confirmationNote: input.confirmationNote,
          videoTimestampSeconds: input.videoTimestampSeconds,
          decidedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
        });
      } else {
        await dependencies.repository.rejectEvidence({
          evidenceId: id,
          confirmationNote: input.confirmationNote,
        });
      }

      return jsonResponse({ evidence: { id, status: decision === "confirm" ? "confirmed" : "rejected" } });
    } catch (error) {
      return repositoryErrorResponse(error);
    }
  };
}

export type { AdminApiDependencies };
