import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";
import { createPublicRestaurantDetailGetHandler } from "@/server/restaurants/public-restaurants-api";

export const dynamic = "force-dynamic";

export const GET = createPublicRestaurantDetailGetHandler(
  createConfiguredPublicRestaurantDependencies(),
);
