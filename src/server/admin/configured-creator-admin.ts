import { createSupabaseAdminAuth } from "./admin-auth";
import type { AdminApiDependencies } from "./creator-admin-api";
import { createCreatorAdminRepository } from "../youtube/creator-admin-repository";
import { runYouTubeSync } from "../youtube/run-youtube-sync";

export function createConfiguredCreatorAdminDependencies(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AdminApiDependencies {
  return {
    auth: createSupabaseAdminAuth(environment),
    repository: createCreatorAdminRepository(environment),
    runSync: () => runYouTubeSync("manual", environment),
  };
}
