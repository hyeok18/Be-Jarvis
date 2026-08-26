import { describe, expect, it } from "vitest";

import { DOMAIN_FIXTURE } from "../src/domain/fixtures";
import { preferenceAnswersToProfile } from "../src/domain/preference-matching";
import { calculateRestaurantMatch } from "../src/domain/signals";

describe("preference matching", () => {
  it("turns survey answers into a local preference profile", () => {
    const profile = preferenceAnswersToProfile({
      favorite: "🍚 한식·찌개",
      spicy: "🌶️ 아주 좋아요",
      staple: "🥩 고기·구이 요리",
      avoid: "🙅 특별히 없어요",
    });

    expect(profile?.axisPreferences.spicy).toBe(75);
    expect(profile?.axisPreferences.rich).toBe(80);
    expect(profile?.excludedFoodTags).toEqual([]);
  });

  it("hard-excludes a restaurant selected in the avoid answer", () => {
    const profile = preferenceAnswersToProfile({
      favorite: "🍣 일식·초밥",
      spicy: "🙂 적당히 좋아요",
      staple: "🍜 국물·면 요리",
      avoid: "🐟 해산물은 어려워요",
    });
    const restaurant = DOMAIN_FIXTURE.restaurantProfiles.find(
      (item) => item.restaurantId === "restaurant-shellfish-table",
    );

    expect(profile).not.toBeNull();
    expect(restaurant).toBeDefined();
    expect(calculateRestaurantMatch({ profile: profile!, restaurant: restaurant! })).toMatchObject({
      status: "excluded",
      matchPercent: 0,
    });
  });
});
