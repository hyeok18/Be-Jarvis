import type {
  Restaurant,
  RestaurantMatchResult,
  RestaurantReactionSummary,
} from "../../domain/types";
import type { CreatorVisitSource } from "../map/map-view-model";

/**
 * Detail-screen input boundary for WU-15.
 *
 * Providers must expose only the public reaction projection and confirmed,
 * fresh creator sources. Raw reactions, visit proofs, moderation state, and
 * creator candidates stay on the server.
 */
export interface RestaurantDetailData {
  restaurant: Restaurant;
  reactionRestaurantId: string | null;
  reactionSummary: RestaurantReactionSummary;
  personalMatch: RestaurantMatchResult;
  creatorVisitSources: readonly CreatorVisitSource[];
}
