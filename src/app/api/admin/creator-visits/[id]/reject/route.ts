import { createEvidenceDecisionPostHandler } from "@/server/admin/creator-admin-api";
import {
  adminServiceNotConfiguredResponse,
  isAdminConfigurationError,
} from "@/server/admin/admin-route-runtime";
import { createConfiguredCreatorAdminDependencies } from "@/server/admin/configured-creator-admin";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return await createEvidenceDecisionPostHandler(
      createConfiguredCreatorAdminDependencies(),
      "reject",
    )(request, context);
  } catch (error) {
    if (isAdminConfigurationError(error)) {
      return adminServiceNotConfiguredResponse(
        "관리자 데이터 서비스가 아직 설정되지 않았습니다.",
      );
    }
    throw error;
  }
}
