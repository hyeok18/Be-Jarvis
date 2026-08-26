import { AdminAuthError, createSupabaseAdminAuth } from "@/server/admin/admin-auth";
import { adminServiceNotConfiguredResponse } from "@/server/admin/admin-route-runtime";
import {
  createAdminSessionDeleteHandler,
  createAdminSessionPostHandler,
} from "@/server/admin/admin-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return await createAdminSessionPostHandler(
      createSupabaseAdminAuth(process.env),
    )(request);
  } catch (error) {
    if (error instanceof AdminAuthError && error.kind === "configuration") {
      return adminServiceNotConfiguredResponse(
        "관리자 로그인이 아직 설정되지 않았습니다.",
      );
    }
    throw error;
  }
}

export const DELETE = createAdminSessionDeleteHandler();
