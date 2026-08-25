import { creatorAllowlist } from "./creator-allowlist";
import { createSupabaseYouTubeRepository } from "./supabase-youtube-repository";
import { createYouTubeDataApiClient } from "./youtube-data-api";
import {
  createYouTubeSyncService,
  type SyncTriggerKind,
} from "./youtube-sync";

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function createConfiguredYouTubeSyncService(
  environment: RuntimeEnvironment,
) {
  return createYouTubeSyncService({
    youtube: createYouTubeDataApiClient({
      apiKey: environment.YOUTUBE_DATA_API_KEY ?? "",
    }),
    repository: createSupabaseYouTubeRepository(environment),
    allowlist: creatorAllowlist,
  });
}

/**
 * Shared server entry point for the WU-13 admin action and WU-14 Cron route.
 * Authentication and concurrent-run locking belong to those later work units.
 */
export async function runYouTubeSync(
  triggerKind: SyncTriggerKind,
  environment: RuntimeEnvironment = process.env,
) {
  return createConfiguredYouTubeSyncService(environment).sync(triggerKind);
}
