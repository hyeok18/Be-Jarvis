export type ActiveVisitProof = Readonly<{
  token: string;
  expiresAt: string;
}>;

type RequestVisitCheckInInput = Readonly<{
  accessToken: string;
  restaurantId: string;
}>;

type MinimalCoordinates = Readonly<{
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}>;

type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type GeolocationLike = Pick<Geolocation, "getCurrentPosition">;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const visitProofTokenPattern = /^[A-Za-z0-9_-]{32,128}$/;

export type VisitCheckInErrorKind =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "accuracy_insufficient"
  | "out_of_range"
  | "auth_required"
  | "invalid_request"
  | "service_unavailable";

function getErrorMessage(kind: VisitCheckInErrorKind) {
  if (kind === "permission_denied") {
    return "위치 권한을 허용하지 않았어요. 반응은 개인 취향으로 계속 저장할 수 있습니다.";
  }
  if (kind === "position_unavailable") {
    return "현재 위치를 확인할 수 없어요. 기기의 위치 설정을 확인해 주세요.";
  }
  if (kind === "timeout") {
    return "위치 확인 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.";
  }
  if (kind === "accuracy_insufficient") {
    return "현재 위치의 정확도가 부족해요. 잠시 후 다시 체크인해 주세요.";
  }
  if (kind === "out_of_range") {
    return "식당 근처에서 다시 체크인해 주세요.";
  }
  if (kind === "auth_required") {
    return "로그인이 만료됐어요. 다시 로그인해 주세요.";
  }
  if (kind === "invalid_request") {
    return "식당 또는 위치 정보를 확인하지 못했어요.";
  }
  return "방문 확인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export class VisitCheckInError extends Error {
  constructor(
    readonly kind: VisitCheckInErrorKind,
    readonly status?: number,
  ) {
    super(getErrorMessage(kind));
    this.name = "VisitCheckInError";
  }
}

function getCurrentCoordinates(geolocation: GeolocationLike) {
  return new Promise<MinimalCoordinates>((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === 1) {
          reject(new VisitCheckInError("permission_denied"));
        } else if (error.code === 3) {
          reject(new VisitCheckInError("timeout"));
        } else {
          reject(new VisitCheckInError("position_unavailable"));
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      },
    );
  });
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseVisitProof(value: unknown): ActiveVisitProof | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const proof = (value as { visitProof?: unknown }).visitProof;
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return null;

  const candidate = proof as Record<string, unknown>;

  if (
    typeof candidate.token !== "string" ||
    !visitProofTokenPattern.test(candidate.token) ||
    candidate.method !== "location_checkin" ||
    typeof candidate.expiresAt !== "string" ||
    Number.isNaN(Date.parse(candidate.expiresAt))
  ) {
    return null;
  }

  return {
    token: candidate.token,
    expiresAt: candidate.expiresAt,
  };
}

function mapResponseFailure(status: number, body: unknown) {
  const code =
    body && typeof body === "object"
      ? (body as { error?: { code?: unknown } }).error?.code
      : null;

  if (status === 401) return new VisitCheckInError("auth_required", status);
  if (code === "ACCURACY_INSUFFICIENT") {
    return new VisitCheckInError("accuracy_insufficient", status);
  }
  if (code === "OUT_OF_RANGE") {
    return new VisitCheckInError("out_of_range", status);
  }
  if (status === 400 || status === 404 || code === "INVALID_LOCATION") {
    return new VisitCheckInError("invalid_request", status);
  }
  return new VisitCheckInError("service_unavailable", status);
}

export async function requestLocationVisitProof(
  input: RequestVisitCheckInInput,
  geolocation: GeolocationLike,
  fetchImplementation: Fetch = fetch,
) {
  const accessToken = input.accessToken.trim();

  if (!accessToken || !uuidPattern.test(input.restaurantId)) {
    throw new VisitCheckInError("invalid_request", 400);
  }

  const coordinates = await getCurrentCoordinates(geolocation);
  let response: Response;

  try {
    response = await fetchImplementation("/api/visits/check-in", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        restaurantId: input.restaurantId,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracyMeters: coordinates.accuracyMeters,
      }),
      cache: "no-store",
    });
  } catch {
    throw new VisitCheckInError("service_unavailable", 503);
  }

  const body = await readJson(response);
  if (!response.ok) throw mapResponseFailure(response.status, body);

  const proof = parseVisitProof(body);
  if (!proof) throw new VisitCheckInError("service_unavailable", 503);
  return proof;
}
