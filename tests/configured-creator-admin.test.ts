import { describe, expect, it } from "vitest";

import { createConfiguredCreatorAdminDependencies } from "../src/server/admin/configured-creator-admin";

describe("configured creator admin dependencies", () => {
  it("defers server configuration validation until an admin request needs it", async () => {
    expect(() => createConfiguredCreatorAdminDependencies({})).not.toThrow();

    const dependencies = createConfiguredCreatorAdminDependencies({});

    expect(() => dependencies.auth.verifyAdminAccessToken("admin-token")).toThrow(
      "configuration",
    );
    expect(() => dependencies.repository.listEvidence()).toThrow("configuration");
    await expect(dependencies.runSync()).rejects.toMatchObject({ kind: "configuration" });
  });
});
