import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { serverEnvironmentKeys } from "../src/lib/env-contract";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return collectSourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function resolveSourceImport(importer: string, specifier: string): string | null {
  const basePath = specifier.startsWith("@/")
    ? join(sourceRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? join(dirname(importer), specifier)
      : null;

  if (!basePath) return null;

  const sourceFiles = new Set(collectSourceFiles(sourceRoot));
  return (
    [basePath, `${basePath}.ts`, `${basePath}.tsx`, join(basePath, "index.ts"), join(basePath, "index.tsx")].find(
      (candidate) => sourceFiles.has(candidate),
    ) ?? null
  );
}

function collectClientReachableFiles(): string[] {
  const allSourceFiles = collectSourceFiles(sourceRoot);
  const pending = allSourceFiles.filter((path) => {
    const source = readFileSync(path, "utf8");
    return (
      path.includes(`${sep}components${sep}`) ||
      /^\s*["']use client["'];/u.test(source)
    );
  });
  const reachable = new Set<string>();

  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || reachable.has(path)) continue;

    reachable.add(path);
    const source = readFileSync(path, "utf8");
    const importPattern =
      /\b(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/gu;

    for (const match of source.matchAll(importPattern)) {
      const dependency = resolveSourceImport(path, match[1]);
      if (dependency && !reachable.has(dependency)) pending.push(dependency);
    }
  }

  return [...reachable];
}

describe("client security boundary", () => {
  it("does not reference server-only keys from client-reachable source", () => {
    const clientReachableFiles = collectClientReachableFiles();

    expect(clientReachableFiles.length).toBeGreaterThan(0);

    for (const path of clientReachableFiles) {
      const source = readFileSync(path, "utf8");
      const displayPath = relative(sourceRoot, path);

      for (const key of serverEnvironmentKeys) {
        expect(source, `${displayPath} references ${key}`).not.toContain(key);
      }

      expect(source, `${displayPath} contains a secret-key marker`).not.toMatch(
        /sb_secret_|service[_-]?role/iu,
      );
    }
  });
});
