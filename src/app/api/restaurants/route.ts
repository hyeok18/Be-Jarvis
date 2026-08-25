import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";
import { createPublicRestaurantListGetHandler } from "@/server/restaurants/public-restaurants-api";

export const dynamic = "force-dynamic";

export const GET = createPublicRestaurantListGetHandler(
  createConfiguredPublicRestaurantDependencies(),
);
