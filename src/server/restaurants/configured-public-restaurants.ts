import { createPublicRestaurantRepository } from "./public-restaurant-repository";

export function createConfiguredPublicRestaurantDependencies(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return {
    repository: createPublicRestaurantRepository(environment),
  };
}
