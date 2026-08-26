import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(
  new URL("../supabase/migrations", import.meta.url),
);
const migrationSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
  .join("\n");
const normalizedSql = migrationSql.replace(/\s+/gu, " ");

const applicationTables = [
  "restaurants",
  "visit_proofs",
  "restaurant_reactions",
  "reaction_events",
  "restaurant_reaction_summaries",
  "creator_channels",
  "creator_videos",
  "creator_visit_evidence",
  "youtube_sync_runs",
] as const;

describe("Supabase security contract", () => {
  it("enables RLS for every public application table", () => {
    for (const table of applicationTables) {
      expect(normalizedSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("keeps ownership policies efficient and authorization metadata safe", () => {
    expect(normalizedSql).toContain(
      "using (user_id = (select auth.uid()));",
    );
    expect(migrationSql).not.toMatch(/auth\.role\s*\(/iu);
    expect(migrationSql).not.toMatch(/raw_user_meta_data|user_metadata/iu);
  });

  it("keeps privileged functions private with explicit search paths and revokes", () => {
    const functionBlocks = migrationSql
      .split(/(?=create or replace function)/iu)
      // ALTER FUNCTION migrations are separate statements. Keep them out of
      // the preceding CREATE block so a later security-definer clause cannot
      // be attributed to the wrong function.
      .map((block) => block.split(/(?=alter function)/iu)[0])
      .filter((block) => /security definer/iu.test(block));

    expect(functionBlocks.length).toBeGreaterThan(0);

    for (const block of functionBlocks) {
      const functionName = block.match(
        /^create or replace function\s+([a-z0-9_.]+)/iu,
      )?.[1];

      expect(functionName).toMatch(/^private\./u);
      expect(block).toMatch(/set search_path\s*=\s*''/iu);
      expect(normalizedSql).toContain(`revoke all on function ${functionName}(`);
    }

    for (const functionName of [
      "public.enforce_reaction_abuse_guard",
      "public.issue_location_visit_proof",
      "public.save_reaction_selection",
      "public.save_reaction_with_visit_proof",
    ]) {
      expect(normalizedSql).toMatch(
        new RegExp(
          `alter function ${functionName.replace(".", "\\.")}\\([^)]+\\) security definer;`,
          "iu",
        ),
      );
    }
  });

  it("avoids broad client grants and retains critical indexes", () => {
    const grantStatements = migrationSql
      .split(";")
      .filter((statement) => /^\s*grant\b/iu.test(statement));

    for (const statement of grantStatements) {
      if (/\bto\s+(?:anon|authenticated)\b/iu.test(statement)) {
        expect(statement).not.toMatch(/^\s*grant\s+all\b/iu);
      }
    }

    for (const index of [
      "restaurant_reactions_visit_proof_owner_idx",
      "restaurant_reactions_counted_idx",
      "reaction_events_actor_user_id_idx",
      "creator_visit_evidence_confirmed_by_idx",
    ]) {
      expect(normalizedSql).toContain(`create index ${index}`);
    }
  });
});
