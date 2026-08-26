import type {
  Restaurant,
  RestaurantMatchResult,
  RestaurantPreferenceProfile,
  RestaurantReactionSummary,
} from "@/domain/types";

import type { CreatorVisitSource } from "./map-view-model";

/**
 * Public-map UI input boundary.
 *
 * WU-15 keeps this UI-shaped contract separate from Supabase rows. The data
 * layer may supply only publishable `counted` reaction summaries and
 * confirmed, fresh creator evidence; the explorer never receives moderation
 * records or private reactions.
 */
export interface MapExplorerData {
  restaurants: readonly Restaurant[];
  reactionSummaries: readonly RestaurantReactionSummary[];
  personalMatches: readonly RestaurantMatchResult[];
  restaurantProfiles: readonly RestaurantPreferenceProfile[];
  creatorVisitSources: readonly CreatorVisitSource[];
}
