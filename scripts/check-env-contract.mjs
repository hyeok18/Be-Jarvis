import { readFileSync } from "node:fs";

const requiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "RATE_LIMIT_NETWORK_SALT",
  "NEXT_PUBLIC_KAKAO_MAP_APP_KEY",
  "KAKAO_REST_API_KEY",
  "YOUTUBE_DATA_API_KEY",
  "CRON_SECRET",
];

const template = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const presentKeys = new Set(
  template
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*=/u.test(line))
    .map((line) => line.slice(0, line.indexOf("="))),
);

const missingKeys = requiredKeys.filter((key) => !presentKeys.has(key));
const serverKeysWithPublicPrefix = [
  "SUPABASE_SECRET_KEY",
  "RATE_LIMIT_NETWORK_SALT",
  "KAKAO_REST_API_KEY",
  "YOUTUBE_DATA_API_KEY",
  "CRON_SECRET",
].filter((key) => key.startsWith("NEXT_PUBLIC_"));

if (missingKeys.length > 0 || serverKeysWithPublicPrefix.length > 0) {
  console.error(
    JSON.stringify({ missingKeys, serverKeysWithPublicPrefix }, null, 2),
  );
  process.exitCode = 1;
} else {
  console.log(`Environment contract valid: ${requiredKeys.length} keys declared.`);
}
