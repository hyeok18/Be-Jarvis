import { describe, expect, it } from "vitest";

import { getFixtureMapExplorerData } from "../src/components/map/map-explorer-fixture";

describe("fixture map explorer boundary", () => {
  it("passes only publishable evidence and counted reaction summaries to the UI", () => {
    const data = getFixtureMapExplorerData();

    expect(data.restaurants).toHaveLength(3);
    expect(data.reactionSummaries).toHaveLength(data.restaurants.length);
    expect(data.creatorVisitSources.map((source) => source.videoId)).toEqual([
      "synthetic-large-video",
      "synthetic-small-video",
      "synthetic-hidden-video",
    ]);
    expect(data.creatorVisitSources.map((source) => source.videoId)).not.toContain(
      "synthetic-candidate-video",
    );
    expect(data.creatorVisitSources.map((source) => source.videoId)).not.toContain(
      "synthetic-stale-video",
    );

    const balancedBowl = data.reactionSummaries.find(
      (summary) => summary.restaurantId === "restaurant-balanced-bowl",
    );
    expect(balancedBowl?.counts).toEqual({ like: 1, okay: 1, dislike: 1 });
    expect(balancedBowl?.countedTotal).toBe(3);
  });
});
