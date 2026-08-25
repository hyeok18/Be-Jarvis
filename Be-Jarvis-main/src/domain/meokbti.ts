export type MeokbtiAnswers = Record<string, string>;

/** Excel 기반 참여자 데이터는 제거했습니다. */
export function calculateMeokbtiExpectedMatch(input: {
  answers: MeokbtiAnswers | null;
  restaurantCategory: string;
  restaurantName?: string;
}) {
  return {
    matchPercent: null,
    culture: null,
    sampleSize: 0,
    likeCount: 0,
    reason: input.answers ? "실제 반응 데이터 연결 후 예상 일치율을 보여드릴게요" : "취향 설정 후 확인",
  };
}
