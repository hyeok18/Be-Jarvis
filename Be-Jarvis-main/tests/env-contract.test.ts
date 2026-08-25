import { describe, expect, it } from "vitest";

import {
  findMissingEnvironmentKeys,
  publicEnvironmentKeys,
  requiredEnvironmentKeys,
  serverEnvironmentKeys,
} from "../src/lib/env-contract";

describe("environment contract", () => {
  it("keeps browser and server keys disjoint", () => {
    expect(publicEnvironmentKeys).toHaveLength(3);
    expect(serverEnvironmentKeys).toHaveLength(4);
    expect(publicEnvironmentKeys.every((key) => key.startsWith("NEXT_PUBLIC_"))).toBe(
      true,
    );
    expect(serverEnvironmentKeys.some((key) => key.startsWith("NEXT_PUBLIC_"))).toBe(
      false,
    );
    expect(new Set(requiredEnvironmentKeys).size).toBe(requiredEnvironmentKeys.length);
  });

  it("reports only missing or blank values", () => {
    const completeEnvironment = Object.fromEntries(
      requiredEnvironmentKeys.map((key) => [key, "configured"]),
    );

    expect(findMissingEnvironmentKeys(completeEnvironment)).toEqual([]);
    expect(
      findMissingEnvironmentKeys({
        ...completeEnvironment,
        CRON_SECRET: " ",
        YOUTUBE_DATA_API_KEY: undefined,
      }),
    ).toEqual(["YOUTUBE_DATA_API_KEY", "CRON_SECRET"]);
  });
});
