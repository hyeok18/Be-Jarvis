import { createEvidenceDecisionPostHandler } from "@/server/admin/creator-admin-api";
import { createConfiguredCreatorAdminDependencies } from "@/server/admin/configured-creator-admin";

export const dynamic = "force-dynamic";

export const POST = createEvidenceDecisionPostHandler(
  createConfiguredCreatorAdminDependencies(),
  "confirm",
);
