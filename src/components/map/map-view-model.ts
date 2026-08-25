import type {
  Restaurant,
  RestaurantMatchResult,
  RestaurantReactionSummary,
} from "@/domain/types";
import type { PublicSubscriberCountState } from "@/contracts/public-restaurants";

export interface CreatorVisitSource {
  restaurantId: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  channelTitle: string;
  subscriberCount: number | null;
  subscriberCountState?: PublicSubscriberCountState;
  hiddenSubscriberCount: boolean;
  publishedAt: string;
  metadataFetchedAt: string;
}

export type ExplorerMode = "public" | "personal";
export type ReactionDataState = "empty" | "forming" | "established";

export function getReactionDataState(
  summary: RestaurantReactionSummary,
): ReactionDataState {
  if (summary.countedTotal === 0) return "empty";
  return summary.isForming ? "forming" : "established";
}

export function sortRestaurantsForMode(
  restaurants: readonly Restaurant[],
  mode: ExplorerMode,
  matches: readonly RestaurantMatchResult[],
) {
  if (mode === "public") return [...restaurants];

  const matchByRestaurantId = new Map(
    matches.map((match) => [match.restaurantId, match]),
  );

  return restaurants
    .filter(
      (restaurant) =>
        matchByRestaurantId.get(restaurant.id)?.status !== "excluded",
    )
    .sort((left, right) => {
      const leftMatch = matchByRestaurantId.get(left.id);
      const rightMatch = matchByRestaurantId.get(right.id);
      const leftPercent = leftMatch?.matchPercent ?? -1;
      const rightPercent = rightMatch?.matchPercent ?? -1;

      return (
        rightPercent - leftPercent || left.name.localeCompare(right.name, "ko")
      );
    });
}

const FOOD_TAG_LABELS: Readonly<Record<string, string>> = {
  shellfish: "갑각류·조개류",
  seafood: "해산물",
  vegetable: "채소",
  dessert: "디저트",
};

export function formatFoodTag(tag: string) {
  return FOOD_TAG_LABELS[tag] ?? tag;
}
