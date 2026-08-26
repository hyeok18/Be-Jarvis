import { createSupabaseAdminAuth } from "./admin-auth";
import type { AdminApiDependencies } from "./creator-admin-api";
import { createCreatorAdminRepository } from "../youtube/creator-admin-repository";
import { runYouTubeSync } from "../youtube/run-youtube-sync";

export function createConfiguredCreatorAdminDependencies(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AdminApiDependencies {
  const auth: AdminApiDependencies["auth"] = {
    verifyAdminAccessToken(accessToken) {
      return createSupabaseAdminAuth(environment).verifyAdminAccessToken(accessToken);
    },
  };

  const repository: AdminApiDependencies["repository"] = {
    listEvidence() {
      return createCreatorAdminRepository(environment).listEvidence();
    },
    listSyncRuns() {
      return createCreatorAdminRepository(environment).listSyncRuns();
    },
    confirmEvidence(input) {
      return createCreatorAdminRepository(environment).confirmEvidence(input);
    },
    rejectEvidence(input) {
      return createCreatorAdminRepository(environment).rejectEvidence(input);
    },
  };

  return {
    auth,
    repository,
    runSync: () => runYouTubeSync("manual", environment),
  };
}
