import type { UserPreferenceProfile } from "./types";

export type PreferenceAnswerKey = "favorite" | "spicy" | "staple" | "avoid";
export type PreferenceAnswers = Partial<Record<PreferenceAnswerKey, string>>;

const ANSWER_AXIS_VALUES: Readonly<Record<string, Partial<Record<string, number>>>> = {
  "🍚 한식·찌개": { spicy: 60, rich: 70, value: 70 },
  "🍣 일식·초밥": { light: 65, cleanliness: 80, service: 75 },
  "🍝 양식·파스타": { rich: 75, cleanliness: 75, service: 70 },
  "🍔 분식·간식": { spicy: 55, sweet: 70, value: 85 },
  "🌶️ 아주 좋아요": { spicy: 90 },
  "🙂 적당히 좋아요": { spicy: 55 },
  "🥛 잘 못 먹어요": { spicy: 20 },
  "🍜 국물·면 요리": { light: 50, rich: 60 },
  "🍛 밥·덮밥 요리": { value: 75, rich: 60 },
  "🥩 고기·구이 요리": { rich: 90, service: 70 },
  "🥗 샐러드·가벼운 요리": { light: 90, cleanliness: 85 },
};

const AVOID_TAGS: Readonly<Record<string, readonly string[]>> = {
  "🙅 특별히 없어요": [],
  "🐟 해산물은 어려워요": ["seafood", "shellfish"],
  "🥜 견과류를 피하고 싶어요": ["nuts"],
  "🥦 채소를 별로 안 좋아해요": ["vegetable"],
  "🥩 고기를 별로 안 좋아해요": ["beef", "pork", "chicken", "meat"],
};

export function preferenceAnswersToProfile(
  answers: PreferenceAnswers | null,
): UserPreferenceProfile | null {
  if (!answers || Object.keys(answers).length === 0) return null;

  const axisValues: Record<string, number[]> = {};
  for (const answer of Object.values(answers)) {
    if (!answer) continue;
    for (const [axis, value] of Object.entries(ANSWER_AXIS_VALUES[answer] ?? {})) {
      if (typeof value !== "number") continue;
      axisValues[axis] = [...(axisValues[axis] ?? []), value];
    }
  }

  const axisPreferences = Object.fromEntries(
    Object.entries(axisValues).map(([axis, values]) => [
      axis,
      Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    ]),
  );
  const excludedFoodTags = Object.values(answers).flatMap(
    (answer) => AVOID_TAGS[answer ?? ""] ?? [],
  );

  return {
    profileVersion: "meokbti-v1",
    axisPreferences,
    excludedFoodTags: Array.from(new Set(excludedFoodTags)),
    onboardingSources: ["direct_input"],
    updatedAt: new Date().toISOString(),
  };
}
