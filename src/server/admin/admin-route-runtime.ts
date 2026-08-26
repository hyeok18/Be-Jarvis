import { AdminAuthError } from "./admin-auth";
import { CreatorAdminRepositoryError } from "../youtube/creator-admin-repository";

export function isAdminConfigurationError(error: unknown) {
  return (
    (error instanceof AdminAuthError && error.kind === "configuration") ||
    (error instanceof CreatorAdminRepositoryError && error.kind === "configuration")
  );
}

export function adminServiceNotConfiguredResponse(message: string) {
  return Response.json(
    { error: { code: "SERVICE_NOT_CONFIGURED", message } },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}
