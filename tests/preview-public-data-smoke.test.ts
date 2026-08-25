import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts", "smoke-preview-public-data.mjs");
const restaurantId = "10000000-0000-4000-8000-000000000001";

const restaurant = {
  id: restaurantId,
  reactionSummary: {
    counts: { like: 1, okay: 0, dislike: 0 },
    countedTotal: 1,
  },
  creatorEvidence: [
    {
      videoUrl: "https://www.youtube.com/watch?v=public-video&t=95s",
      publishedAt: "2026-08-25T09:00:00.000Z",
      videoMetadataFetchedAt: "2026-08-25T10:00:00.000Z",
      lastVerifiedAt: "2026-08-25T11:00:00.000Z",
      channel: {
        subscriberCount: 123_456,
        subscriberCountState: "known",
        subscriberCountFetchedAt: "2026-08-25T10:00:00.000Z",
      },
    },
  ],
};

const restaurants = Array.from({ length: 30 }, (_, index) => ({
  ...restaurant,
  id: index === 0 ? restaurantId : `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
}));

function runSmoke(environment: Record<string, string | undefined>) {
  return new Promise<{ exitCode: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (exitCode) => resolve({ exitCode, output }));
  });
}

function jsonResponse(response: import("node:http").ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

type PreviewRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
) => void;

async function createPreviewServer(
  handler: PreviewRequestHandler,
) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server failed to bind");
  return { server, previewUrl: `http://127.0.0.1:${address.port}` };
}

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(async (server) => {
      server.close();
      await once(server, "close");
    }),
  );
});

describe("Preview public data smoke script", () => {
  it("does not call a network endpoint when PREVIEW_URL is missing", async () => {
    const result = await runSmoke({ PREVIEW_URL: "" });

    expect(result.exitCode).toBe(2);
    expect(result.output).toContain("PREVIEW_URL_REQUIRED");
    expect(result.output).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("verifies the 30-restaurant list and first detail with public fields only", async () => {
    const { server, previewUrl } = await createPreviewServer((request, response) => {
      if (request.url === "/api/restaurants") {
        jsonResponse(response, {
          ok: true,
          data: { restaurants },
          meta: { restaurantCount: 30 },
        });
        return;
      }
      if (request.url === `/api/restaurants/${restaurantId}`) {
        jsonResponse(response, {
          ok: true,
          data: { restaurant: restaurants[0] },
          meta: { restaurantCount: 1 },
        });
        return;
      }
      jsonResponse(response, { ok: false }, 404);
    });
    servers.push(server);

    const result = await runSmoke({ PREVIEW_URL: previewUrl });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("PASS: 30 restaurants");
    expect(result.output).not.toContain("public-video");
  });

  it("reports a 503 without logging the response body", async () => {
    const { server, previewUrl } = await createPreviewServer((_request, response) => {
      jsonResponse(
        response,
        { error: "server-secret-and-response-body-must-not-be-printed" },
        503,
      );
    });
    servers.push(server);

    const result = await runSmoke({ PREVIEW_URL: previewUrl });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("PUBLIC_DATA_UNAVAILABLE");
    expect(result.output).not.toContain("server-secret-and-response-body-must-not-be-printed");
  });

  it("fails a sensitive response without printing its fields or values", async () => {
    const unsafeRestaurants = [
      { ...restaurants[0], candidate: "admin-only-value" },
      ...restaurants.slice(1),
    ];
    const { server, previewUrl } = await createPreviewServer((request, response) => {
      if (request.url === "/api/restaurants") {
        jsonResponse(response, {
          ok: true,
          data: { restaurants: unsafeRestaurants },
          meta: { restaurantCount: 30 },
        });
        return;
      }
      jsonResponse(response, { ok: false }, 404);
    });
    servers.push(server);

    const result = await runSmoke({ PREVIEW_URL: previewUrl });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("PUBLIC_CONTRACT_INVALID");
    expect(result.output).not.toContain("candidate");
    expect(result.output).not.toContain("admin-only-value");
  });
});
