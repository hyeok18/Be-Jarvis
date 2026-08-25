const REACTION_RESTAURANT_IDS = {
  "restaurant-balanced-bowl": "10000000-0000-4000-8000-000000000001",
  "restaurant-shellfish-table": "10000000-0000-4000-8000-000000000002",
  "restaurant-green-table": "10000000-0000-4000-8000-000000000003",
} as const satisfies Readonly<Record<string, string>>;

export function getReactionRestaurantId(fixtureRestaurantId: string) {
  return (
    REACTION_RESTAURANT_IDS[
      fixtureRestaurantId as keyof typeof REACTION_RESTAURANT_IDS
    ] ?? null
  );
}
