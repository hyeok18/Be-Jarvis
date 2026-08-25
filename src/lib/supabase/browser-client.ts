import type { SupabaseClient } from "@supabase/supabase-js";

type BrowserSupabaseEnvironment = Readonly<{
  url: string | undefined;
  publishableKey: string | undefined;
}>;

export type BrowserSupabaseConfiguration = Readonly<{
  url: string;
  publishableKey: string;
}>;

let browserClientPromise: Promise<SupabaseClient | null> | null = null;

function isAllowedProjectUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export function resolveBrowserSupabaseConfiguration(
  environment: BrowserSupabaseEnvironment,
): BrowserSupabaseConfiguration | null {
  const url = environment.url?.trim();
  const publishableKey = environment.publishableKey?.trim();

  if (
    !url ||
    !publishableKey ||
    !isAllowedProjectUrl(url) ||
    !publishableKey.startsWith("sb_publishable_")
  ) {
    return null;
  }

  return { url, publishableKey };
}

export function getBrowserSupabaseClient() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!browserClientPromise) {
    browserClientPromise = (async () => {
      const configuration = resolveBrowserSupabaseConfiguration({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      });

      if (!configuration) return null;

      const { createClient } = await import("@supabase/supabase-js");

      return createClient(configuration.url, configuration.publishableKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
        },
      });
    })().catch(() => null);
  }

  return browserClientPromise;
}
