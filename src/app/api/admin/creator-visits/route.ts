import { createCreatorEvidenceGetHandler } from "@/server/admin/creator-admin-api";
import { createConfiguredCreatorAdminDependencies } from "@/server/admin/configured-creator-admin";

export const dynamic = "force-dynamic";

export const GET = createCreatorEvidenceGetHandler(
  createConfiguredCreatorAdminDependencies(),
);
