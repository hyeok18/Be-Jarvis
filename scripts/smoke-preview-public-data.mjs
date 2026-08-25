const requiredReactionKinds = ["like", "okay", "dislike"];
const subscriberStates = new Set(["known", "hidden", "stale", "unavailable"]);
const forbiddenKeys = new Set([
  "held",
  "private_only",
  "privateonly",
  "rejected",
  "proof",
  "visit_proof",
  "visitproof",
  "gps",
  "raw_gps",
  "rawgps",
  "original_gps",
  "originalgps",
  "user_id",
  "userid",
  "confirmed_by",
  "confirmedby",
  "confirmation_note",
  "confirmationnote",
  "admin_note",
  "adminnote",
  "candidate",
  "status",
  "risk_codes",
  "riskcodes",
]);
const forbiddenValues = new Set([
  "held",
  "private_only",
  "rejected",
  "candidate",
]);

function fail(code, message, exitCode = 1) {
  console.error(`[preview-public-data-smoke] FAIL ${code}: ${message}`);
  process.exitCode = exitCode;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isIsoDateTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function requireRecord(value, path) {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

function requireString(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function requireIsoDateTime(value, path) {
  if (!isIsoDateTime(value)) throw new Error(`${path} must be an ISO timestamp`);
  return value;
}

function assertNoSensitivePublicFields(value, path = "response") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitivePublicFields(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === "string" && forbiddenValues.has(value.toLowerCase())) {
      throw new Error(`${path} contains a non-public moderation value`);
    }
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replaceAll("-", "_");
    if (
      forbiddenKeys.has(normalizedKey) ||
      normalizedKey.includes("held") ||
      normalizedKey.includes("private_only") ||
      normalizedKey.includes("rejected") ||
      normalizedKey.includes("candidate") ||
      normalizedKey.includes("proof") ||
      normalizedKey.includes("gps") ||
      normalizedKey === "user" ||
      (normalizedKey.includes("user") && normalizedKey.includes("id")) ||
      normalizedKey.includes("admin")
    ) {
      throw new Error(`${path}.${key} is not allowed in a public response`);
    }
    assertNoSensitivePublicFields(nested, `${path}.${key}`);
  }
}

function assertReactionSummary(value, path) {
  const summary = requireRecord(value, path);
  const counts = requireRecord(summary.counts, `${path}.counts`);
  const countedTotal = summary.countedTotal;

  if (!isNonNegativeInteger(countedTotal)) {
    throw new Error(`${path}.countedTotal must be a non-negative integer`);
  }

  let total = 0;
  for (const kind of requiredReactionKinds) {
    const count = counts[kind];
    if (!isNonNegativeInteger(count)) {
      throw new Error(`${path}.counts.${kind} must be a non-negative integer`);
    }
    total += count;
  }

  if (total !== countedTotal) {
    throw new Error(`${path}.counts must equal ${path}.countedTotal`);
  }
}

function assertYouTubeUrl(value, path) {
  const text = requireString(value, path);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${path} must be a YouTube URL`);
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.youtube.com" ||
    url.pathname !== "/watch" ||
    !url.searchParams.get("v")
  ) {
    throw new Error(`${path} must be a public YouTube watch URL`);
  }
}

function assertCreatorEvidence(value, path) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);

  for (const [index, item] of value.entries()) {
    const evidencePath = `${path}[${index}]`;
    const evidence = requireRecord(item, evidencePath);
    assertYouTubeUrl(evidence.videoUrl, `${evidencePath}.videoUrl`);
    requireIsoDateTime(evidence.publishedAt, `${evidencePath}.publishedAt`);
    requireIsoDateTime(
      evidence.videoMetadataFetchedAt,
      `${evidencePath}.videoMetadataFetchedAt`,
    );
    requireIsoDateTime(evidence.lastVerifiedAt, `${evidencePath}.lastVerifiedAt`);

    const channel = requireRecord(evidence.channel, `${evidencePath}.channel`);
    if (!subscriberStates.has(channel.subscriberCountState)) {
      throw new Error(`${evidencePath}.channel.subscriberCountState is invalid`);
    }

    if (channel.subscriberCountState === "known") {
      if (!isNonNegativeInteger(channel.subscriberCount)) {
        throw new Error(`${evidencePath}.channel.subscriberCount must be raw data`);
      }
      requireIsoDateTime(
        channel.subscriberCountFetchedAt,
        `${evidencePath}.channel.subscriberCountFetchedAt`,
      );
    } else if (channel.subscriberCount !== null) {
      throw new Error(`${evidencePath}.channel.subscriberCount must be null when not known`);
    }
  }
}

function assertRestaurant(value, path) {
  const restaurant = requireRecord(value, path);
  requireString(restaurant.id, `${path}.id`);
  assertReactionSummary(restaurant.reactionSummary, `${path}.reactionSummary`);
  assertCreatorEvidence(restaurant.creatorEvidence, `${path}.creatorEvidence`);
  return restaurant;
}

function assertListContract(value) {
  const body = requireRecord(value, "list response");
  if (body.ok !== true) throw new Error("list response.ok must be true");
  const data = requireRecord(body.data, "list response.data");
  const meta = requireRecord(body.meta, "list response.meta");
  if (!Array.isArray(data.restaurants)) {
    throw new Error("list response.data.restaurants must be an array");
  }
  if (data.restaurants.length !== 30) {
    throw new Error("list response must contain exactly 30 restaurants");
  }
  if (meta.restaurantCount !== 30 || meta.restaurantCount !== data.restaurants.length) {
    throw new Error("list response.meta.restaurantCount must equal 30");
  }

  assertNoSensitivePublicFields(body);
  return data.restaurants.map((restaurant, index) =>
    assertRestaurant(restaurant, `list response.data.restaurants[${index}]`),
  );
}

function assertDetailContract(value, expectedId) {
  const body = requireRecord(value, "detail response");
  if (body.ok !== true) throw new Error("detail response.ok must be true");
  const data = requireRecord(body.data, "detail response.data");
  const meta = requireRecord(body.meta, "detail response.meta");
  if (meta.restaurantCount !== 1) {
    throw new Error("detail response.meta.restaurantCount must equal 1");
  }

  assertNoSensitivePublicFields(body);
  const restaurant = assertRestaurant(data.restaurant, "detail response.data.restaurant");
  if (restaurant.id !== expectedId) {
    throw new Error("detail response restaurant ID must match the list restaurant");
  }
  return restaurant;
}

async function requestJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 503) {
      throw new Error("PUBLIC_DATA_UNAVAILABLE");
    }
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    try {
      return await response.json();
    } catch {
      throw new Error("INVALID_JSON");
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error("TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function previewBaseUrl() {
  const value = process.env.PREVIEW_URL?.trim();
  if (!value) return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("INVALID_PREVIEW_URL");
  }

  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error("UNSAFE_PREVIEW_URL");
  }
  return url;
}

async function main() {
  let baseUrl;
  try {
    baseUrl = previewBaseUrl();
  } catch {
    fail("INVALID_PREVIEW_URL", "PREVIEW_URL must be an HTTPS Preview origin.", 2);
    return;
  }

  if (!baseUrl) {
    fail(
      "PREVIEW_URL_REQUIRED",
      "Set PREVIEW_URL to a Vercel Preview origin before running this smoke test.",
      2,
    );
    return;
  }

  try {
    const list = await requestJson(new URL("/api/restaurants", baseUrl));
    const restaurants = assertListContract(list);
    const first = restaurants[0];
    const detail = await requestJson(
      new URL(`/api/restaurants/${encodeURIComponent(first.id)}`, baseUrl),
    );
    assertDetailContract(detail, first.id);

    const evidenceCount = restaurants.reduce(
      (count, restaurant) => count + restaurant.creatorEvidence.length,
      0,
    );
    console.log(
      `[preview-public-data-smoke] PASS: 30 restaurants and ${evidenceCount} public creator evidence item(s) verified.`,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    const safeReason =
      reason === "PUBLIC_DATA_UNAVAILABLE"
        ? reason
        : reason === "TIMEOUT"
          ? reason
          : reason.startsWith("HTTP_")
            ? reason
            : reason === "INVALID_JSON"
              ? reason
              : "PUBLIC_CONTRACT_INVALID";
    const message =
      safeReason === "PUBLIC_DATA_UNAVAILABLE"
        ? "The public data API returned 503; Preview is reachable but data is unavailable."
        : safeReason === "TIMEOUT"
          ? "The public data API did not respond before the timeout."
          : safeReason.startsWith("HTTP_")
            ? `The public data API returned ${safeReason.slice("HTTP_".length)}.`
            : safeReason === "INVALID_JSON"
              ? "The public data API did not return JSON."
              : "The public data contract check failed.";
    fail(safeReason, message);
  }
}

await main();
