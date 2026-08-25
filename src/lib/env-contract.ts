export const publicEnvironmentKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_KAKAO_MAP_APP_KEY",
] as const;

export const serverEnvironmentKeys = [
  "SUPABASE_SECRET_KEY",
  "KAKAO_REST_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "CRON_SECRET",
] as const;

export const requiredEnvironmentKeys = [
  ...publicEnvironmentKeys,
  ...serverEnvironmentKeys,
] as const;

export function findMissingEnvironmentKeys(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return requiredEnvironmentKeys.filter((key) => !environment[key]?.trim());
}
