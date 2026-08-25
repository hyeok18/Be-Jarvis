# PRD: 신뢰할 수 있는 맛집 지도

## 문서 정보

| 항목 | 내용 |
|---|---|
| 상태 | 팀 인터뷰 2차 반영 — 24시간 MVP 구현 계약 |
| 확정일 | 2026-08-25 |
| 최신 요구 반영 | 2026-08-25 — 다면 별점·커뮤니티 반응·개인화 매칭 |
| 대상 지역 | 서울 성수동 |
| 대상 플랫폼 | 반응형 웹 |
| 배포 | Vercel Preview / Production |
| 핵심 기술 | Next.js, TypeScript, Supabase, Kakao Maps, GPT-5.6 Luna |
| 인프라 실행 기준 | Supabase·Vercel 플러그인으로 사전 점검하고 migration·Preview·Production 게이트로 실행 |

이 문서는 심층 인터뷰에서 확정한 24시간 해커톤 MVP의 범위와 수용 기준이다. 구현 중 판단이 충돌하면 이 문서를 우선하며, 필수 기능을 완료하기 전에는 선택 기능을 시작하지 않는다.

---

## 1. 제품 요약

### 한 문장 정의

맛·청결·서비스의 다면 별점과 리뷰 신뢰도를 함께 계산하고, 공개 종합순위와 **나와의 매칭순위**를 근거와 함께 제공하는 성수동 맛집 랭킹 서비스다.

### 해결하려는 공공의 문제

금전·음식·할인·서비스 제공을 받은 홍보성 리뷰가 일반 이용자의 선택을 왜곡할 수 있지만, 기존 맛집 서비스의 평균 별점만으로는 그 영향을 파악하기 어렵다. 소비자에게 직접 광고 여부를 신고하거나 증명하게 하는 대신, 서비스가 여러 통계·문장·리뷰어 행동 신호를 분석해 리뷰의 신뢰도를 계산하고 점수 조정 근거를 설명한다.

### 제품이 하지 않는 주장

- 특정 리뷰가 광고·조작·사기라고 확정하지 않는다.
- 하나의 신호만으로 리뷰를 부정 리뷰 또는 허위 리뷰로 분류하지 않는다.
- 실제 업체의 품질이나 광고 행위를 판정하지 않는다.
- 리뷰를 자동 삭제하지 않는다.

---

## 2. 목표와 성공 기준

### MVP 목표

발표자가 5분 안에 다음 과정을 안정적으로 시연할 수 있어야 한다.

1. 성수동 맛집 종합순위와 원점수·신뢰도·종합점수를 비교한다.
2. 한 식당의 대표 리뷰와 점수가 조정된 근거를 확인한다.
3. 관리자가 의심 패턴을 가진 합성 리뷰를 추가한다.
4. 관리자가 `지금 분석`을 실행한다.
5. 분석 성공 후 리뷰 신뢰도, 종합점수, 순위가 변경된 것을 확인한다.
6. 상세 화면에서 고평점 급증, 문장 유사도, 리뷰어 패턴, AI 분석 근거를 확인한다.

### 해커톤 성공 조건

- 필수 시연 흐름을 동일한 배포 환경에서 3회 연속 완료한다.
- 발표 전 P0(시연 불가능) 및 P1(핵심 결과 오류) 버그가 0개다.
- API 오류가 발생해도 마지막 정상 분석 결과가 사라지지 않는다.
- 실시간 시연 실패 시 30초 안에 발표용 백업 시나리오로 전환할 수 있다.
- 모든 점수는 저장된 원본 데이터와 알고리즘 버전으로 재계산할 수 있다.

### 핵심 사용자

#### 일반 사용자

- 로그인 없이 성수동 맛집 랭킹을 본다.
- 맛·청결·서비스 평점, 공개 종합점수와 대표 리뷰를 빠르게 확인한다.
- 익명 로컬 선호 설정을 완료하면 나와의 매칭도와 매칭순위를 본다.
- 필요할 때만 상세 분석 근거를 펼쳐본다.
- MVP에서는 공개 서버 데이터를 작성하거나 수정하지 않으며 선호·제외 음식·방문 만족도는 브라우저 로컬에만 둔다.

#### 관리자

- Supabase Auth의 단일 관리자 계정으로 로그인한다.
- 리뷰를 개별 입력하거나 CSV로 일괄 등록한다.
- 분석을 수동 실행하고 실행 로그를 확인한다.
- 발표용 백업 시나리오를 활성화하거나 해제한다.

---

## 3. 범위

### 필수 범위

- 성수동 실제 식당 30곳의 기본 정보
- 식당당 합성 리뷰 20개, 총 약 600개의 초기 데이터
- 전체 종합순위 상위 10개
- 음식 카테고리 필터
- 맛·청결·서비스 점수, 공개 평점, 리뷰 신뢰도, 종합점수 비교
- 리뷰별 합성 좋아요·싫어요 집계에 따른 커뮤니티 가중치
- 밸런스 게임·직접 취향·안 먹는 음식으로 만드는 익명 로컬 선호 프로필
- 전체 종합순위와 나와의 매칭순위 탭
- 매칭도, 개인화 신뢰도, 매칭 근거 표시
- 대표 리뷰 3개와 리뷰별 신뢰도
- 분석 근거 상세 보기
- Kakao 지도에서 식당 위치 확인
- 관리자 로그인, 개별 리뷰 등록, CSV 등록
- 전체 리뷰 규칙 분석과 의심 후보의 GPT 추가 분석
- 관리자 수동 분석과 매일 03:00 KST 자동 분석
- 분석 실행 로그 및 마지막 정상 결과 유지
- 발표용 사전 계산 백업 시나리오
- 데스크톱과 모바일 반응형 UI
- Vercel Preview 및 Production 배포

### 시간이 남을 때만 하는 선택 범위

- 팀 활동 지역 추가
- 현재 위치 중심 탐색
- 숨겨진 관리자 진입 경로
- 더 많은 음식 카테고리와 정렬 방식
- 분석 기준값을 수정하는 관리자 UI
- 리뷰 데이터 내보내기
- 계정 기반 선호 동기화와 여러 기기 간 방문 만족도 공유

선택 범위는 필수 시연 흐름 3회 연속 성공과 P0/P1 버그 0개를 달성한 뒤에만 시작한다.

### MVP 제외 범위

- 일반 사용자 회원가입 및 리뷰 작성
- 실제 사용자 좋아요·싫어요의 서버 저장과 공개 집계
- 계정 기반 협업 필터링 학습과 장기 행동 프로필
- 네이버·카카오·구글 등 외부 리뷰 크롤링
- 실제 협찬 또는 광고 여부 판정
- 신고, 제재, 업체 이의신청 절차
- 성수동 외 전국 서비스
- 결제, 광고 판매, 수익화
- 네이티브 iOS·Android 앱
- 실시간 알림 및 소셜 기능

---

## 4. 데이터 원칙과 고지

### 데이터 출처

- 식당명, 주소, 좌표, 카테고리 등 기본 정보는 Kakao 장소 검색 API에서 가져와 DB에 저장한다.
- 리뷰는 시연 목적으로 직접 생성한 합성 데이터만 사용한다.
- 외부 서비스의 실제 리뷰는 수집하거나 재게시하지 않는다.

### 필수 고지 문구

랭킹, 상세 화면, 관리자 발표 모드에 다음 의미가 명확하게 보여야 한다.

> 해커톤 데모용 합성 리뷰와 자동 분석 결과입니다. 실제 업체의 평가 또는 광고 행위 판정이 아닙니다.

리뷰 신뢰도 근처에는 다음 의미의 보조 문구를 제공한다.

> 여러 패턴을 바탕으로 계산한 참고 지표이며, 리뷰 조작 여부를 증명하지 않습니다.

### 원본 보존

- `reviews`의 원문, 별점, 작성 시각, 리뷰어 식별키는 분석 결과와 분리한다.
- 맛·청결·서비스의 원본 입력값과 계산된 리뷰 종합별점·가중치·식당 점수는 분리한다.
- 분석 실행은 원본 리뷰를 수정하거나 삭제하지 않는다.
- 중복 입력은 `external_id`로 막고, 관리상 제외가 필요하면 소프트 비활성화한다.
- 모든 파생 결과는 `analysis_run_id`와 `algorithm_version`을 기록한다.
- 공개 점수에는 사용자별 취향이나 리뷰어 유사도를 입력하지 않는다.
- 개인화 결과는 공개 점수를 덮어쓰지 않으며 로컬 선호 프로필 버전과 매칭 알고리즘 버전을 함께 기록한다.

---

## 5. 별점·공개 점수·개인화 매칭 정의

### 사용자에게 안내할 0~5점 기준

리뷰 하나는 다음 세 항목을 각각 0~5 범위의 0.5점 단위로 입력한다.

| 항목 | 질문 | 공개 비중 |
|---|---|---:|
| 맛 | 음식 자체가 다시 방문할 가치가 있었는가? | 60% |
| 청결 | 식기·테이블·매장 상태가 쾌적했는가? | 20% |
| 서비스 | 주문·응대·제공 과정이 만족스러웠는가? | 20% |

공통 점수 의미는 다음과 같다.

| 점수 | 의미 |
|---:|---|
| 0점 | 다시 이용하고 싶지 않음 |
| 1점 | 기대보다 크게 부족함 |
| 2점 | 대안이 없을 때 고려할 수준 |
| 3점 | 만족스럽다고 말할 수 있음 |
| 4점 | 일부러 방문할 가치가 있음 |
| 5점 | 오래 기억할 만큼 특별함 |

```text
리뷰 종합별점 = 맛 × 0.60 + 청결 × 0.20 + 서비스 × 0.20
```

비중은 `algorithm_config.rating_weights`에 버전과 함께 저장하며 합계가 정확히 1이어야 한다.

### 커뮤니티 반응 가중치

공개 점수에는 리뷰어 개인의 평판·활동량·사용자와의 유사도를 가중치로 사용하지 않는다. 리뷰별 좋아요·싫어요 집계만 다음처럼 완만하게 반영한다.

```text
반응 균형 = (좋아요 수 - 싫어요 수) / (좋아요 수 + 싫어요 수 + 10)
커뮤니티 가중치 = clamp(1 + 0.5 × 반응 균형, 0.75, 1.25)
```

- 반응이 없으면 가중치는 1이다.
- 분모의 `10`은 표본이 적을 때 한두 표가 점수를 크게 바꾸지 않게 하는 사전 강도다.
- 상·하한은 다수 투표가 한 리뷰를 무제한 증폭하거나 제거하지 않게 한다.
- 해커톤 P0는 합성 fixture의 좋아요·싫어요 집계를 사용한다.
- 실제 사용자 투표는 계정별 리뷰당 1표, 자기 리뷰 투표 차단, 변경 가능, rate limit, 감사 기록을 갖춘 후속 기능으로 구현한다.

### 공개 식당 점수 공식

모든 평균에서 `wᵢ`는 리뷰 `i`의 커뮤니티 가중치다.

```text
맛 점수 = Σ(맛ᵢ × wᵢ) / Σwᵢ
청결 점수 = Σ(청결ᵢ × wᵢ) / Σwᵢ
서비스 점수 = Σ(서비스ᵢ × wᵢ) / Σwᵢ
공개 평점 = Σ(리뷰 종합별점ᵢ × wᵢ) / Σwᵢ
식당 리뷰 신뢰도 = Σ(리뷰 최종 신뢰도ᵢ × wᵢ) / Σwᵢ
종합점수 = 공개 평점 × (식당 리뷰 신뢰도 / 100)
```

- 공개 평점과 종합점수 계산은 `reviewer_key`, 리뷰어 활동량, 개인 취향을 읽지 않는다.
- 화면에서는 별점과 종합점수를 소수점 둘째 자리에서 반올림해 소수점 한 자리로 표시한다.
- 상세 근거에서는 계산에 사용한 둘째 자리 값을 확인할 수 있다.
- 종합순위는 종합점수 내림차순, 동점이면 식당 리뷰 신뢰도, 활성 리뷰 수, 식당명 순으로 정한다.
- 식당 또는 리뷰어 점수는 서로의 이전 점수를 다시 입력으로 사용하는 순환 계산을 하지 않는다.

### 나와의 매칭도 권장 공식

P0의 개인화 입력은 로그인 없이 브라우저에만 저장한다. 추천 입력 순서는 안 먹는 음식 선택, 짧은 밸런스 게임, 취향 직접 조정, 방문 식당 만족도다.

1. `excluded_food_tags`와 식당 음식 태그가 겹치면 기본적으로 개인화 후보에서 제외한다. 사용자가 원하면 제외 결과를 직접 해제할 수 있다.
2. 취향 적합도는 맵기·단맛·담백함·풍미·가격 민감도·청결 중시·서비스 중시 축의 거리로 0~100을 계산한다.
3. 유사 리뷰어 적합도는 공통 평가 식당이 5곳 이상일 때만 사용한다.
4. 방문 만족도 적합도는 사용자가 남긴 이전 만족도와 유사 식당 프로필이 있을 때만 사용한다.
5. 사용할 수 없는 신호의 비중은 0점으로 처리하지 않고 사용 가능한 신호끼리 다시 정규화한다.

기본 비중은 다음과 같다.

```text
나와의 매칭도 = 취향 적합도 × 0.50
               + 유사 리뷰어 적합도 × 0.30
               + 방문 만족도 적합도 × 0.20
```

초기 사용자처럼 이력이 없으면 취향 적합도만 100% 사용한다. 개인화 리뷰 신뢰도는 공개 커뮤니티 가중치에 리뷰어 유사도 가중치 `0.5~1.5`를 추가해 계산할 수 있지만, 그 결과는 해당 사용자 화면에만 사용하고 공개 식당 신뢰도에 저장하거나 반영하지 않는다.

```text
개인화 품질 = (공개 평점 / 5 × 100) × (개인화 리뷰 신뢰도 / 100)
개인화 랭킹점수 = 나와의 매칭도 × 0.60 + 개인화 품질 × 0.40
```

개인화 화면은 매칭도와 함께 `안 먹는 음식 제외`, `매운맛 선호`, `유사 취향 리뷰어`, `이전 방문 만족도` 중 실제로 사용된 근거만 보여준다.

### 데이터 부족 상태

- 활성 리뷰가 10개 미만이면 순위를 계산하더라도 `평점 형성 중` 배지를 표시한다.
- 선호 입력이 없으면 매칭 숫자를 임의 생성하지 않고 `취향 설정 필요`로 표시한다.
- 유사 리뷰어 공통 평가가 5개 미만이면 협업 신호를 제외하고 `취향 중심 계산`으로 표시한다.
- 초기 30개 식당은 각각 20개 리뷰를 가지므로 기본 공개 시연에서는 `평점 형성 중`이 나타나지 않는다.

---

## 6. 리뷰 신뢰도 분석

### 분석 흐름

```text
원본 리뷰 저장
→ 모든 리뷰 규칙 기반 분석
→ 규칙상 의심 후보만 GPT-5.6 Luna 분석
→ 리뷰별 최종 신뢰도 계산
→ 식당별 점수 집계
→ 전체 실행 성공 시 새 결과 공개
```

### 규칙 기반 신호

모든 기준값과 감점값은 `algorithm_config`에 버전과 함께 저장한다. MVP 기본값은 다음과 같다.

| 코드 | 신호 | 기본 판정 | 기본 영향 |
|---|---|---|---:|
| `RATING_BURST` | 단기간 고평점 급증 | 7일 구간 리뷰 5개 이상, 4점 이상 비율 80% 이상, 구간 외 기준보다 30%p 이상 높음 | -15 |
| `TEXT_SIMILARITY` | 리뷰 문장 유사 | 같은 식당 내 20자 이상 리뷰를 정규화한 뒤 토큰 2-gram Jaccard 유사도 0.82 이상 | -25 |
| `REVIEWER_ONE_SIDED` | 리뷰어 성향 참고 | 리뷰 5개 이상인 리뷰어의 평점 분산 0.10 이하 또는 5점 비율 90% 이상 | 공개 영향 0, 개인화 전용 |
| `VAGUE_TEMPLATE` | 짧고 구체성 낮은 문장 | 정규화 길이 15자 미만이며 메뉴·맛·경험에 대한 구체 정보가 없음 | -10 |

텍스트 정규화는 Unicode NFKC 적용, 영문 소문자화, 문장부호 제거, 연속 공백 축소 순으로 수행한다.

### 규칙 점수와 AI 호출 조건

```text
규칙 점수 = clamp(100 - 규칙 감점 합계, 0, 100)
```

공개 영향이 있는 `RATING_BURST`, `TEXT_SIMILARITY`, `VAGUE_TEMPLATE` 신호만 다음 후보 판정에 사용한다. `REVIEWER_ONE_SIDED`는 공개 규칙 점수와 GPT 후보 수에 포함하지 않는다.

다음 중 하나를 만족할 때만 GPT 분석 후보가 된다.

- 서로 다른 규칙 신호가 2개 이상이다.
- 규칙 점수가 70점 이하이다.

신호가 하나뿐인 리뷰는 점수에 제한적으로 반영할 수 있지만, 의심 리뷰라고 단정하거나 AI 분석 결과처럼 표시하지 않는다.

### GPT-5.6 Luna 분석

- 모델 ID는 서버 환경변수 `OPENAI_MODEL`로 관리하고 MVP 기본값은 `gpt-5.6-luna`다.
- 입력에는 합성 리뷰 본문과 규칙 신호, 익명화된 리뷰어 통계만 포함한다.
- 식당명, 관리자 계정, API 키는 전송하지 않는다.
- 응답은 Structured Output으로 제한하고 원문 자유서술을 그대로 점수로 사용하지 않는다.

필수 출력 필드:

```json
{
  "promotional_pattern_strength": 0,
  "natural_specificity": 0,
  "confidence": 0,
  "reason_codes": [],
  "short_explanation": ""
}
```

각 숫자는 0~100 범위다. 결정적 표현인 `fraud`, `fake`, `조작 확정`은 UI 설명에 사용하지 않는다.

AI 조정값은 다음 고정 규칙으로 계산한다.

| 조건 | AI 조정값 |
|---|---:|
| `confidence < 60` | 0 |
| `promotional_pattern_strength >= 70`이고 `natural_specificity < 40` | -15 |
| `promotional_pattern_strength >= 55` | -8 |
| `natural_specificity >= 70` | +8 |
| 그 외 | 0 |

```text
리뷰 최종 신뢰도 = clamp(규칙 점수 + AI 조정값, 0, 100)
```

- AI 호출에 실패하면 규칙 점수를 최종 신뢰도로 사용하고 `규칙 분석만 완료` 상태를 남긴다.
- 같은 리뷰와 같은 알고리즘·모델 버전의 성공 결과가 있으면 재사용한다.
- 사용자 화면이 열릴 때 AI를 다시 호출하지 않는다.

### 사용자 표시 등급

| 최종 신뢰도 | 표시 |
|---:|---|
| 80~100 | 신뢰도 높음 |
| 60~79 | 추가 확인 권장 |
| 0~59 | 주의 깊게 보기 |

등급은 탐색 편의를 위한 표현이며 허위·광고 판정이 아니다.

### 대표 리뷰 선정

- 최종 신뢰도가 높은 순서로 최대 3개를 선택한다.
- 같은 리뷰어의 리뷰는 하나만 선택한다.
- 구체 정보가 없는 짧은 리뷰는 후순위로 둔다.
- 동점이면 최근 리뷰를 우선한다.
- 신뢰도 60점 미만 리뷰는 대표 리뷰에서 제외하고 상세 분석 영역에서만 보여준다.
- 긍정·부정 감정은 선정 기준으로 사용하지 않는다.

---

## 7. 화면 요구사항

### `/` — 종합 랭킹

필수 요소:

- 서비스명과 합성 데이터 고지
- `전체`, `한식`, `일식`, `중식`, `양식`, `카페` 카테고리 필터
- `종합순위`, `나와의 매칭순위` 탭과 현재 정렬 기준
- 현재 조건의 상위 10개
- 각 카드의 순위, 식당명, 카테고리, 맛·청결·서비스 점수, 공개 평점, 리뷰 신뢰도, 종합점수, 리뷰 수
- 선호 프로필이 있으면 나와의 매칭도와 개인화 계산 근거 요약
- 선호 프로필이 없으면 `취향 설정하기` 진입점
- 선택 식당의 Kakao 지도 마커와 위치
- 데이터 기준 시각
- 발표 백업 모드 활성화 시 눈에 띄되 과격하지 않은 배너

데스크톱에서는 왼쪽 랭킹 목록에 공개 점수와 나와의 매칭도를 함께 보여주고 오른쪽에 지도를 둔다. 모바일에서는 랭킹을 먼저 보여주고 지도는 탭 또는 접을 수 있는 영역으로 제공한다.

### `/preferences` 또는 취향 설정 패널

- 로그인 없이 사용할 수 있어야 한다.
- 안 먹는 음식은 hard exclusion 태그로 입력한다.
- 5~8개의 짧은 밸런스 게임과 직접 슬라이더 입력 중 하나만 완료해도 시작할 수 있다.
- 이전 방문 식당 만족도는 선택 입력이며 0~5의 0.5점 단위다.
- 저장 전 어떤 정보가 브라우저에만 남는지 알려준다.
- 초기화·전체 삭제 동작을 제공한다.

### `/restaurants/[id]` — 식당 상세

처음 보이는 기본 정보:

- 식당명, 카테고리, 주소, 지도 위치
- 종합점수, 공개 평점, 맛·청결·서비스 점수, 리뷰 신뢰도
- `공개 평점 × 리뷰 신뢰도` 공식과 계산값
- 선호 프로필이 있으면 나와의 매칭도·개인화 신뢰도와 사용된 근거
- 대표 리뷰 최대 3개
- 리뷰별 신뢰도 백분율
- `신뢰도 분석 자세히 보기` 버튼

상세 분석을 펼치면 보여줄 정보:

- 고평점 급증 신호와 해당 기간
- 문장 유사도 신호와 비교 근거
- 리뷰어 평점 분산 또는 편향 근거
- GPT 분석 여부와 요약
- 리뷰별 감점·가점 항목
- 리뷰별 커뮤니티 반응 가중치와 합성 반응 데이터 고지
- 적용한 알고리즘 버전과 분석 시각
- 자동 분석이 조작을 증명하지 않는다는 고지

극단적인 부정 리뷰도 대표 리뷰 선정에서 자동 우대하지 않는다. 신뢰도와 구체성 기준을 동일하게 적용한다.

### `/admin/login` — 관리자 로그인

- 이메일과 비밀번호 입력
- 로그인 실패 이유를 안전한 일반 문구로 표시
- 로그인 완료 시 `/admin`으로 이동
- 일반 사용자 회원가입 링크는 제공하지 않는다.

### `/admin` — 관리자 콘솔

필수 영역:

1. 현재 공개 중인 분석 실행과 마지막 성공 시각
2. 개별 리뷰 입력 폼
3. CSV 업로드
4. `지금 분석` 버튼과 실행 상태
5. 최근 분석 실행 로그
6. 발표용 `기준 상태`, `변경 후 상태` 백업 불러오기
7. 백업 모드 해제 버튼

개별 입력 필드:

- 식당
- 외부 고유 ID
- 리뷰어 키
- 맛 별점
- 청결 별점
- 서비스 별점
- 합성 좋아요 수
- 합성 싫어요 수
- 리뷰 본문
- 리뷰 작성일

CSV 필수 헤더:

```csv
external_id,restaurant_kakao_place_id,reviewer_key,taste_rating,cleanliness_rating,service_rating,helpful_count,unhelpful_count,review_text,reviewed_at
```

업로드 결과는 성공 행 수, 실패 행 수, 실패 행 번호와 이유를 보여준다. 업로드 직후에는 분석하지 않고 다음 자동 분석 또는 `지금 분석`을 기다린다.

### 공통 UI 상태

- 로딩: 스켈레톤 또는 명확한 진행 상태
- 빈 결과: 필터를 바꾸라는 안내
- 지도 오류: 목록은 유지하고 주소 텍스트를 보여줌
- 최신 분석 실패: 마지막 정상 결과와 실패 안내, 기준 시각 표시
- 백업 모드: 모든 공개 화면에 `발표용 저장 결과 사용 중` 표시

### 시각 방향

- 익숙한 지도 서비스의 검색·목록·마커 구조를 따른다.
- 공공서비스처럼 차분하고 신뢰감 있는 네이비·청록 계열을 사용한다.
- 빨간색은 심각한 경고 또는 오류에만 사용한다.
- 점수 위계를 명확히 하고 과장된 `가짜 리뷰 적발` 표현을 사용하지 않는다.
- 키보드 포커스, 색상 외 상태 표시, 폼 라벨을 제공한다.

---

## 8. 시스템 설계 계약

### 기술 구성

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Postgres + Auth
- Kakao Maps JavaScript SDK + Kakao 장소 검색 API
- OpenAI API의 GPT-5.6 Luna Structured Output
- Vercel Functions + Vercel Cron

MCP와 개발용 플러그인은 팀의 구현·검증을 돕는 도구로 사용할 수 있지만, 배포된 서비스의 런타임 필수 요소로 만들지 않는다.

### Supabase·Vercel 플러그인 실행 계약

확인 기준일은 2026-08-25다. Supabase와 Vercel 플러그인은 개발 제어면에서 프로젝트·schema·migration·배포 상태를 조회하고 검증하는 데 사용한다. 애플리케이션의 Production 런타임은 MCP 또는 Codex 플러그인 연결 없이 동작해야 한다.

현재 연결 점검 결과:

- Supabase 계정에는 이 저장소와 이름이 일치하지 않는 기존 프로젝트만 있으므로 임의로 재사용하지 않는다.
- Vercel 계정의 연결된 팀에는 이 저장소용 프로젝트가 아직 없다.
- 새 Supabase 프로젝트 또는 유료 branch는 조직, 리전, 비용을 사용자에게 보여주고 명시적으로 확인받은 뒤 만든다.
- Vercel 프로젝트는 GitHub 저장소 `hyeok18/Be-Jarvis`와 연결하고 Production branch를 `main`으로 고정한다.

플러그인 사용 순서:

1. Supabase 플러그인으로 조직·프로젝트·branch·migration 상태를 읽는다.
2. 이 저장소 전용 project 또는 development branch를 선택한 뒤 로컬 migration을 적용한다.
3. security/performance advisor를 실행하고 경고를 해결한 뒤 TypeScript DB 타입을 생성한다.
4. Vercel 플러그인으로 팀·프로젝트·환경별 변수 이름을 점검한다.
5. feature branch를 Preview로 배포하고 smoke test를 통과시킨다.
6. DB 변경이 있으면 호환 가능한 migration을 먼저 검증하고, 같은 검증을 통과한 Preview artifact만 Production으로 승격한다.
7. 배포 후 build log와 runtime error를 확인하며 실패 시 Vercel rollback과 DB forward-fix migration을 사용한다.

공식 기준 출처:

- Supabase 보안·RLS: <https://supabase.com/docs/guides/database/secure-data>
- Supabase API 키: <https://supabase.com/docs/guides/getting-started/api-keys>
- Supabase Next.js Auth: <https://supabase.com/docs/guides/auth/quickstarts/nextjs>
- Supabase breaking changes: <https://supabase.com/changelog?types=breaking-change>
- Vercel 환경 분리: <https://vercel.com/docs/environment-variables/manage-across-environments>
- Vercel 배포: <https://vercel.com/docs/deployments>

### 환경별 인프라 토폴로지

| 환경 | Git 기준 | Supabase | Vercel | Cron |
|---|---|---|---|---|
| Local | 개발자 작업 브랜치 | local stack 또는 비용 확인된 development branch | `vercel env pull`로 Development 이름만 동기화 | 실행 금지 |
| Preview | feature/PR branch | 별도 Supabase branch 우선, 불가하면 합성 데이터 전용 project를 사용자 승인 후 공유 | PR별 Preview URL | 실행 금지 |
| Production | `main` | Production project와 승인된 migration | Production deployment | 매일 03:00 KST |

- Preview와 Production은 각각 별도의 Supabase URL·publishable key·secret key를 사용한다.
- 같은 Supabase project를 공유해야 하는 24시간 MVP 예외는 합성 데이터만 존재하고 사용자가 위험을 승인한 경우에만 허용한다.
- `.vercel/project.json`, `.env.local`, plugin 인증 상태는 로컬 설정이며 Git에 커밋하지 않는다.
- project ID와 key 값을 문서·개발일지·터미널 요약에 출력하지 않는다.

### 주요 서버 경로

| 경로 | 역할 | 권한 |
|---|---|---|
| `POST /api/admin/reviews` | 개별 리뷰 등록 | 관리자 |
| `POST /api/admin/reviews/import` | CSV 검증·일괄 등록 | 관리자 |
| `POST /api/admin/analysis/run` | 전체 분석 수동 실행 | 관리자 |
| `GET /api/admin/analysis/runs` | 실행 로그 조회 | 관리자 |
| `POST /api/admin/presentation-mode` | 백업 모드 활성화·해제 | 관리자 |
| `GET /api/cron/daily-analysis` | 매일 전체 분석 | `CRON_SECRET` |

수동 분석과 자동 분석은 같은 서비스 함수를 호출해야 하며 계산 로직을 복제하지 않는다.

### 분석 실행과 원자적 공개

1. `analysis_runs`에 `running` 실행을 만든다.
2. 모든 규칙 분석과 필요한 AI 분석을 새 `run_id` 아래 저장한다.
3. 식당별 집계 결과를 같은 `run_id` 아래 저장한다.
4. 검증이 모두 성공하면 하나의 트랜잭션에서 실행을 `succeeded`로 바꾸고 `active_analysis_run_id`를 갱신한다.
5. 중간에 실패하면 실행을 `failed`로 기록하고 기존 `active_analysis_run_id`를 유지한다.
6. 이미 `running`인 실행이 있으면 두 번째 실행은 시작하지 않고 409와 현재 실행 ID를 반환한다.

이 구조로 초기 데이터나 새 알고리즘이 잘못되어도 마지막 정상 결과가 자동으로 덮어써지지 않게 한다.

### 자동 분석 일정

- 실행 시각: 매일 03:00 KST
- Vercel Cron 표현식: `0 18 * * *` (UTC)
- Cron 경로는 `CRON_SECRET`으로 검증한다.
- Production 배포에서만 자동 실행한다.
- 성공·실패·처리 건수·AI 호출 건수·실패 요약을 `analysis_runs`에 남긴다.

### 발표용 백업 시나리오

DB의 `presentation_snapshots`에 최소 두 개의 읽기 전용 JSON 스냅샷을 저장한다.

- `baseline`: 의심 패턴 리뷰 추가 전 랭킹과 상세 결과
- `after-suspicious-import`: 의심 패턴 리뷰 추가·분석 후 랭킹과 상세 결과

관리자가 스냅샷을 활성화하면 공개 데이터 접근 계층은 실시간 결과 대신 선택 스냅샷을 반환한다. 원본 리뷰나 정상 분석 결과를 덮어쓰지 않는다. 활성화·해제 시각과 관리자 ID를 로그로 남긴다.

### 데이터 모델

#### `restaurants`

- `id uuid primary key default gen_random_uuid()`
- `kakao_place_id text unique not null`
- `name text not null`
- `category_group_code text`
- `category_name text not null`
- `road_address text`
- `address text`
- `latitude numeric not null`
- `longitude numeric not null`
- `region text not null default '성수동'`
- `created_at timestamptz not null default now()`

#### `reviews` — 원본 데이터

- `id uuid primary key default gen_random_uuid()`
- `external_id text unique not null`
- `restaurant_id uuid not null references restaurants(id) on delete restrict`
- `reviewer_key text not null`
- `taste_rating numeric(2,1) not null check (taste_rating between 0 and 5 and taste_rating * 2 = trunc(taste_rating * 2))`
- `cleanliness_rating numeric(2,1) not null check (cleanliness_rating between 0 and 5 and cleanliness_rating * 2 = trunc(cleanliness_rating * 2))`
- `service_rating numeric(2,1) not null check (service_rating between 0 and 5 and service_rating * 2 = trunc(service_rating * 2))`
- `review_text text not null`
- `reviewed_at timestamptz not null`
- `source text not null check (source in ('seed','admin_form','csv'))`
- `is_active boolean not null default true`
- `created_by uuid null references auth.users(id) on delete set null`
- `created_at timestamptz not null default now()`

#### `review_feedback_summaries` — 공개 집계 입력

- `review_id uuid primary key references reviews(id) on delete cascade`
- `helpful_count integer not null default 0 check (helpful_count >= 0)`
- `unhelpful_count integer not null default 0 check (unhelpful_count >= 0)`
- `source text not null check (source in ('seed','live_aggregate'))`
- `updated_at timestamptz not null default now()`

P0에서는 합성 seed 집계만 사용한다. 실제 투표 이벤트의 진실원본은 후속 `review_votes` 테이블로 분리하고 이 표는 aggregate projection으로만 갱신한다.

#### `analysis_runs`

- `id uuid primary key default gen_random_uuid()`
- `trigger_type text not null check (trigger_type in ('seed','manual','cron'))`
- `status text not null check (status in ('running','succeeded','failed'))`
- `algorithm_version text not null`
- `model_id text`
- `total_reviews integer not null default 0 check (total_reviews >= 0)`
- `ai_candidate_count integer not null default 0 check (ai_candidate_count >= 0)`
- `ai_success_count integer not null default 0 check (ai_success_count >= 0)`
- `error_summary text`
- `started_at timestamptz not null default now()`
- `finished_at timestamptz`
- `created_by uuid null references auth.users(id) on delete set null`

#### `review_analyses` — 파생 데이터

- `id uuid primary key default gen_random_uuid()`
- `analysis_run_id uuid not null references analysis_runs(id) on delete cascade`
- `review_id uuid not null references reviews(id) on delete restrict`
- `rule_signals jsonb not null`
- `rule_score integer not null check (rule_score between 0 and 100)`
- `ai_required boolean not null`
- `ai_result jsonb`
- `ai_adjustment integer not null default 0 check (ai_adjustment between -100 and 100)`
- `final_trust integer not null check (final_trust between 0 and 100)`
- `explanation jsonb not null`
- `created_at timestamptz not null default now()`
- unique: `(analysis_run_id, review_id)`

#### `restaurant_scores`

- `analysis_run_id uuid not null references analysis_runs(id) on delete cascade`
- `restaurant_id uuid not null references restaurants(id) on delete restrict`
- `taste_score numeric(4,2) not null check (taste_score between 0 and 5)`
- `cleanliness_score numeric(4,2) not null check (cleanliness_score between 0 and 5)`
- `service_score numeric(4,2) not null check (service_score between 0 and 5)`
- `public_rating numeric(4,2) not null check (public_rating between 0 and 5)`
- `review_trust_percent numeric(5,2) not null check (review_trust_percent between 0 and 100)`
- `overall_score numeric(4,2) not null check (overall_score between 0 and 5)`
- `review_count integer not null check (review_count >= 0)`
- primary key: `(analysis_run_id, restaurant_id)`

#### `app_settings`

- `singleton boolean primary key default true check (singleton)`
- `active_analysis_run_id uuid null references analysis_runs(id) on delete restrict`
- `presentation_mode boolean not null default false`
- `active_snapshot_id uuid null references presentation_snapshots(id) on delete restrict`
- `algorithm_config jsonb not null`
- `updated_at timestamptz not null default now()`
- `updated_by uuid null references auth.users(id) on delete set null`

#### `presentation_snapshots`

- `id uuid primary key default gen_random_uuid()`
- `snapshot_key text unique not null`
- `payload jsonb not null`
- `payload_hash text not null`
- `created_at timestamptz not null default now()`
- `created_by uuid null references auth.users(id) on delete set null`

### 개인화 데이터 경계

P0의 선호 데이터는 버전 있는 JSON 형태로 브라우저 저장소에만 둔다. 서버 로그·분석 입력·공개 캐시에 원문을 전송하지 않는다. 사용자가 직접 초기화할 수 있어야 하며 schema가 맞지 않는 이전 버전은 안전하게 무시한다.

계정 기반 기능으로 확장할 때는 다음 진실원본을 서로 분리한다.

- `user_preferences`: 사용자별 취향 축, 제외 음식, onboarding 버전
- `visit_feedback`: 사용자별 식당 만족도와 방문 시각
- `review_votes`: 사용자별 리뷰당 `helpful` 또는 `unhelpful` 한 표
- `user_restaurant_matches`: 사용자·식당·matching algorithm version별 파생 결과와 근거

모든 사용자 소유 테이블은 `user_id uuid not null references auth.users(id) on delete cascade`를 갖고 `user_id` 인덱스를 둔다. `review_votes`는 `(user_id, review_id)`를 unique로 제한한다. RLS는 `to authenticated`와 `(select auth.uid()) = user_id` 소유권을 함께 검사하며 UPDATE에는 `USING`과 `WITH CHECK`를 모두 둔다. 개인화 파생 결과는 공개 DTO나 공개 캐시에 포함하지 않는다.

### Migration·인덱스·동시성 계약

- `supabase/migrations/`의 SQL 파일을 schema의 단일 진실원본으로 사용한다.
- Dashboard에서 즉석 DDL을 실행하고 기록 없이 끝내지 않는다. 원격 schema 변경은 검토된 migration 이름과 SQL로만 적용한다.
- migration은 가능한 한 backward-compatible하게 작성하고, destructive 변경은 별도 백업·복구 절차와 사용자 승인이 없으면 실행하지 않는다.
- 모든 외래키 열은 조인·삭제 검증을 위해 인덱스를 둔다.
- 기본 인덱스는 다음을 포함한다.

```text
restaurants(category_name, name)
reviews(restaurant_id, reviewed_at desc) where is_active = true
reviews(reviewer_key, reviewed_at desc) where is_active = true
analysis_runs(status, started_at desc)
review_analyses(review_id)
restaurant_scores(restaurant_id, overall_score desc)
```

- `analysis_runs`에는 `status = 'running'` 행이 하나만 존재하도록 partial unique index를 둔다.
- 분석 시작은 짧은 transaction 안에서 advisory try-lock과 running 실행 생성을 함께 처리해 수동·Cron 경합을 막는다.
- 외부 OpenAI 호출은 DB transaction 밖에서 수행하고, 공개 실행 전환 transaction은 집계 검증과 `active_analysis_run_id` 갱신만 포함한다.
- DDL 이후 Supabase security advisor와 performance advisor를 모두 실행하고 치명 경고를 해결한 뒤 TypeScript 타입을 재생성한다.

### Supabase 권한

- 공개 스키마의 모든 테이블에 RLS를 활성화한다.
- 브라우저의 Supabase publishable key는 관리자 Auth 세션에만 사용하며 application table을 직접 조회하거나 수정하지 않는다.
- 공개 랭킹·상세 조회는 Next.js Server Component 또는 Route Handler의 서버 데이터 계층이 필요한 열만 명시적으로 선택해 안전한 DTO로 반환한다.
- application table은 `anon`, `authenticated`에 대한 기본 권한을 회수하고 필요한 권한만 명시적으로 부여한다. Data API의 자동 테이블 노출을 전제로 하지 않는다.
- 쓰기, 분석 실행, 로그, 설정, 스냅샷은 관리자 서버 경로로만 접근한다.
- 관리자 판정은 수정 가능한 `user_metadata`가 아니라 서버에서 검증한 사용자 ID 또는 `app_metadata.role = 'admin'`을 사용한다.
- 관리자 API는 cookie 기반 세션의 현재 사용자를 검증한 다음에만 서버 전용 Supabase secret client를 사용한다.
- Supabase secret/service-role 키는 RLS를 우회하므로 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- view가 필요하면 Postgres 15+의 `security_invoker = true`를 사용한다. `security definer` 함수는 private schema, 명시적 호출자 검사, 빈 `search_path`, `PUBLIC` 실행권한 회수 없이 만들지 않는다.
- 인증이 필요한 응답은 공개 캐시에 저장하지 않는다.
- 후속 사용자 취향·방문·투표 테이블은 소유자만 읽고 쓰게 하며 `anon` 권한을 부여하지 않는다.
- 공개 식당 점수 생성 쿼리는 사용자 소유 테이블과 조인하지 않는다.

### 환경변수

`.env.example`에는 이름과 설명만 넣고 실제 값은 커밋하지 않는다.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=
KAKAO_REST_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
CRON_SECRET=
```

환경변수 값은 Supabase/Vercel 플러그인 응답에서 문서나 로그로 복사하지 않는다. Vercel Development·Preview·Production에 같은 이름을 각각 설정하고 Preview와 Production의 Supabase 값은 분리한다.

---

## 9. 초기 데이터와 데이터 오염 방지

### 초기 데이터 구성

- 성수동 식당 30개를 Kakao 장소 검색 결과에서 선택해 고정한다.
- 식당당 합성 리뷰 20개를 넣는다.
- 모든 리뷰는 맛·청결·서비스 별점을 각각 가지며 종합별점은 저장 fixture가 아니라 버전 설정으로 계산한다.
- 리뷰마다 합성 좋아요·싫어요 집계를 두되 극단적인 가중치만 만들지 않도록 무반응·긍정 우세·부정 우세 경계를 포함한다.
- 매칭 검증용 합성 사용자 선호·제외 음식·방문 만족도와 리뷰어 유사도 fixture를 실제 사용자 데이터와 분리한다.
- 정상 패턴, 고평점 급증, 문장 반복, 리뷰어 편향, 복합 의심 패턴을 의도적으로 포함한다.
- 시연용 의심 리뷰 추가 파일은 기본 600개와 별도 fixture로 관리한다.
- seed 버전과 생성 규칙을 Git에 기록한다.

### 초기 데이터가 잘못됐을 때의 복구

- 원본 seed와 파생 분석 결과를 분리한다.
- seed fixture는 버전 관리하고 같은 입력으로 재생성할 수 있어야 한다.
- 새 분석 실행은 전체 성공 전까지 공개 결과가 되지 않는다.
- `baseline` 발표 스냅샷은 발표 전 최종 리허설을 통과한 결과만 저장한다.
- 잘못된 리뷰는 삭제 대신 `is_active = false`로 제외해 기록을 보존한다.
- 점수 계산은 이전 식당 순위나 신뢰도를 입력으로 사용하지 않아 초기 오류가 순환 증폭되지 않는다.

---

## 10. 수용 기준과 검증 방법

| ID | 수용 기준 | 재현 가능한 검증 |
|---|---|---|
| AC-01 | 홈에서 성수동 상위 10개와 다면 별점·공개 평점·신뢰도·종합점수를 볼 수 있다. | 초기 seed 후 `/`에서 10개 카드와 맛·청결·서비스·공개 평점·신뢰도·종합점수를 확인한다. |
| AC-02 | 공개 평점과 종합점수는 버전 있는 다면 별점·커뮤니티 가중치 공식과 일치한다. | 고정 fixture로 60:20:20 종합별점, 반응 가중치, 공개 가중평균과 `공개 평점 × 신뢰도` 경계값을 검증한다. |
| AC-03 | 카테고리 필터가 순위와 지도 마커를 함께 갱신한다. | 전체에서 한식으로 전환해 비한식 카드·마커가 사라지는지 확인한다. |
| AC-04 | 상세 화면에서 다면 별점·공개 점수 공식과 분석 근거를 단계적으로 볼 수 있다. | 식당 카드 클릭 후 기본 정보와 `자세히 보기` 전후 내용을 비교한다. |
| AC-05 | 대표 리뷰는 신뢰도 상위, 리뷰어 중복 없음, 60점 미만 제외 규칙을 따른다. | 대표 리뷰 fixture에 대한 단위 테스트와 상세 화면을 확인한다. |
| AC-06 | 규칙 신호 하나만으로 조작 확정 표현이 나오지 않는다. | 단일 신호 fixture를 분석해 AI 미호출과 중립 문구를 확인한다. |
| AC-07 | 복합 신호 후보만 GPT 분석을 받고 결과가 DB에 저장된다. | 1개 신호/2개 신호 fixture를 실행해 AI 호출 수와 저장 행을 비교한다. |
| AC-08 | OpenAI 실패 시 규칙 점수로 완료하고 사용자 조회가 중단되지 않는다. | API 오류 mock으로 분석 후 `규칙 분석만 완료` 상태와 결과 조회를 확인한다. |
| AC-09 | 관리자가 세 별점과 합성 반응 집계를 가진 리뷰를 등록할 수 있고 중복 ID는 거부된다. | 같은 `external_id`를 두 번 등록해 첫 번째 성공, 두 번째 오류를 확인한다. |
| AC-10 | 다면 별점·합성 반응 CSV 업로드가 성공·실패 행과 이유를 제공한다. | 정상 2행과 오류 2행 CSV를 올려 집계 및 행 번호를 확인한다. |
| AC-11 | 수동 분석 후 점수와 순위가 새 성공 실행으로 변경된다. | 시연 fixture 등록 전후의 실행 ID, 점수, 순위를 비교한다. |
| AC-12 | 실패한 분석은 기존 공개 결과를 덮어쓰지 않는다. | 중간 실패를 강제로 발생시키고 `active_analysis_run_id`가 유지되는지 확인한다. |
| AC-13 | 매일 03:00 KST Cron 설정과 인증이 존재한다. | `vercel.json`의 `0 18 * * *` 및 잘못된/정상 `CRON_SECRET` 응답을 확인한다. |
| AC-14 | 비관리자는 관리자 API를 실행할 수 없다. | 비로그인 및 일반 세션으로 각 POST를 호출해 401/403을 확인한다. |
| AC-15 | 백업 스냅샷을 30초 안에 활성화하고 원상 복귀할 수 있다. | 관리자에서 두 스냅샷을 전환하고 공개 배너·데이터·원본 불변을 확인한다. |
| AC-16 | Kakao 지도 실패 시 랭킹과 주소는 계속 보인다. | 지도 SDK 로드를 차단하고 목록·주소·오류 안내를 확인한다. |
| AC-17 | 390px 모바일과 1440px 데스크톱에서 핵심 기능을 사용할 수 있다. | 두 viewport로 홈·상세·관리자 핵심 흐름을 수행한다. |
| AC-18 | 합성 데이터·자동 분석 고지가 모든 관련 공개 화면에 보인다. | 홈과 상세, 백업 모드에서 고지 문구를 확인한다. |
| AC-19 | Preview와 Production 빌드가 동일 테스트를 통과한다. | PR Preview에서 smoke test 후 `main` 병합, Production에서 다시 수행한다. |
| AC-20 | 전체 발표 흐름이 3회 연속 성공한다. | 발표 체크리스트에 실행 시각, 실행 ID, 결과를 세 번 기록한다. |
| AC-21 | 관리자에서 실행 중·성공·실패 상태, 마지막 성공 시각, 처리 건수를 볼 수 있다. | 성공 실행과 강제 실패 실행을 각각 만들고 로그 목록과 상세값을 확인한다. |
| AC-22 | 로딩·빈 결과·API 오류 상태에서 빈 화면이나 앱 충돌이 발생하지 않는다. | 각 상태 mock을 적용해 안내 문구와 재시도 또는 대체 정보를 확인한다. |
| AC-23 | 핵심 기능을 키보드로 조작할 수 있고 상태를 색상만으로 전달하지 않는다. | Tab/Enter로 필터·상세·관리자 폼을 조작하고 배지에 텍스트가 있는지 확인한다. |
| AC-24 | Supabase schema와 Vercel 배포가 플러그인 사전 점검, 환경 분리, migration·Preview·Production 게이트를 따른다. | 관련 WU에서 프로젝트 목록 확인, migration/advisor/type 생성 증거, 환경별 변수 이름 비교, Preview smoke test와 Production 승격·rollback 절차를 확인한다. |
| AC-25 | 리뷰의 맛·청결·서비스 입력과 60:20:20 종합별점이 같은 버전 설정으로 재현된다. | 세 항목의 0·0.5·5 경계와 가중치 합계 1, 고정 fixture 결과를 테스트한다. |
| AC-26 | 선호 프로필이 있으면 종합순위와 나와의 매칭순위를 전환할 수 있다. | 익명 선호 fixture로 두 탭의 정렬 차이, 매칭도와 사용 근거 표시를 확인한다. |
| AC-27 | 공개 점수는 리뷰어 개인 가중치를 사용하지 않고 좋아요·싫어요 커뮤니티 가중치만 사용한다. | 리뷰어 키·유사도를 바꿔도 공개 결과가 같고, 반응 집계를 바꾸면 정의한 상·하한 안에서만 변하는지 테스트한다. |
| AC-28 | 개인화 계산만 유사 리뷰어·방문 만족도를 사용하고 안 먹는 음식은 hard exclusion으로 처리한다. | cold-start, 공통 평가 5개 미만, 충분한 유사도, 제외 음식 fixture를 각각 검증한다. |

### 필수 자동 검증 명령

프로젝트 구현 시 다음 스크립트를 `package.json`에 제공한다.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

단위 테스트 최소 대상:

- 점수 공식과 반올림
- 다면 별점 60:20:20과 가중치 합계
- 커뮤니티 반응 가중치의 무반응·상한·하한
- 공개 계산의 리뷰어 개인 가중치 비의존성
- 개인화 cold-start·신호 재정규화·hard exclusion
- 네 가지 규칙 신호와 경계값
- AI 조정값 결정표
- 대표 리뷰 선정
- CSV 검증과 중복 처리
- 실패한 실행이 활성 실행을 바꾸지 않는 로직

---

## 11. 4인 분업

### 사용자 화면 팀 — 2명

#### A1: 랭킹·상세 담당

- 홈 랭킹, 카테고리 필터
- 종합순위·나와의 매칭순위 탭, 점수 카드와 상세 분석 UI
- 익명 로컬 취향 설정과 매칭 근거 UI
- 로딩·빈 결과·오류 상태
- AC-01~AC-05, AC-17~AC-18, AC-25~AC-26, AC-28 담당

#### A2: 지도·디자인·반응형 담당

- Kakao 지도와 마커 연동
- 데스크톱/모바일 레이아웃
- 공통 컴포넌트와 접근성
- 지도 실패 fallback
- AC-03, AC-16~AC-17, AC-23 담당

### 데이터·분석 팀 — 2명

#### B1: DB·관리자·데이터 담당

- Supabase 스키마, RLS, 관리자 Auth
- Kakao 식당 seed, 합성 리뷰 fixture
- 관리자 폼과 CSV 업로드
- AC-09~AC-10, AC-14, AC-25, AC-27 담당

#### B2: 분석·운영 안정성 담당

- 규칙 엔진, GPT Structured Output
- 다면 별점·커뮤니티 가중치·개인화 매칭 엔진
- 공개/개인화 점수 분리와 실행 로그
- Cron, 원자적 공개, 백업 스냅샷
- AC-02, AC-06~AC-08, AC-11~AC-15, AC-21~AC-22, AC-25, AC-27~AC-28 담당

### 공통 규칙

- 첫 2시간 안에 DB 타입, fixture 예시, 화면 mock 데이터 계약을 함께 고정한다.
- 두 팀은 mock 데이터로 먼저 병렬 개발한다.
- 공유 파일(`package.json`, DB migration, 공통 타입)은 담당자를 정하고 동시에 수정하지 않는다.
- 각 PR은 다른 팀원 한 명이 검토한다.
- AI가 만든 코드는 작성자가 설명하고 테스트한 뒤에만 병합한다.

---

## 12. 24시간 실행 계획

| 시간 | 목표 | 종료 조건 |
|---:|---|---|
| H0~H2 | 저장소·환경·DB 계약·fixture 확정 | 네 명 모두 로컬 실행, 타입과 mock 데이터 합의 |
| H2~H6 | 최소 수직 흐름 | 홈에서 DB 식당 1개와 점수 표시, 관리자 로그인 성공 |
| H6~H12 | 두 팀 핵심 기능 병렬 구현 | 랭킹/상세/지도와 규칙 분석/입력이 각각 동작 |
| H12~H16 | 통합 | 30개·600리뷰로 랭킹부터 상세까지 연결 |
| H16~H20 | 운영 기능 | 수동 분석, Cron, 실행 로그, 백업 모드 완성 |
| H20 | 기능 동결 | 필수 범위 외 신규 기능 금지 |
| H20~H22 | 오류 수정·반응형·배포 검증 | P0/P1 0개, Preview smoke test 통과 |
| H22~H24 | 발표 리허설 | 3회 연속 성공, 두 백업 스냅샷 최종 저장 |

---

## 13. 발표 운영 계획

### 기본 시연

1. Production 홈에서 기본 랭킹을 보여준다.
2. 익명 시연 선호 프로필을 적용해 `나와의 매칭순위`로 전환하고 순위 차이와 근거를 보여준다.
3. 상세 화면에서 다면 별점·종합점수 공식과 대표 리뷰를 설명한다.
4. 관리자에서 시연용 의심 리뷰 CSV를 등록한다.
5. `지금 분석`을 실행하고 실행 로그를 보여준다.
6. 홈에서 변경된 종합점수와 순위를 확인한다.
7. 상세 분석에서 여러 신호와 GPT 보조 분석 근거를 보여준다.

### 장애 시 전환

- 분석이 지연되면 `after-suspicious-import` 스냅샷을 활성화한다.
- 현재 화면 새로고침 후 `발표용 저장 결과 사용 중` 배너를 짧게 고지한다.
- 지도 API가 실패하면 주소와 랭킹으로 시연을 계속한다.
- Production 자체가 실패하면 발표 전에 확인한 Vercel Preview URL을 사용한다.

### 발표 전 체크리스트

- [ ] Production과 최신 Preview 모두 접속 가능
- [ ] 관리자 로그인 가능
- [ ] Kakao 지도 키 도메인 등록 확인
- [ ] OpenAI 잔액·키·모델 접근 확인
- [ ] `baseline`, `after-suspicious-import` 스냅샷 확인
- [ ] 실시간 시연용 CSV 로컬 복사본 준비
- [ ] 최근 정상 분석 실행 ID 기록
- [ ] 3회 연속 리허설 기록
- [ ] P0/P1 버그 0개 확인

---

## 14. 구현 시 열어둘 설정값

다음 값은 코드에 흩어 쓰지 않고 하나의 버전 있는 `algorithm_config`에서 관리한다.

- 규칙별 임계값과 감점값
- GPT 후보 기준
- AI 조정값 결정표
- 대표 리뷰 최소 신뢰도
- `평점 형성 중` 최소 리뷰 수
- 맛·청결·서비스 비중과 별점 입력 단위
- 커뮤니티 반응 사전 강도·변화폭·상하한
- 매칭 신호 비중·유사 리뷰어 최소 공통 평가 수
- 개인화 랭킹에서 매칭도와 품질의 비중

MVP 기본값은 이 문서의 값을 사용한다. 발표 전 값을 변경하면 알고리즘 버전을 올리고 전체 재분석과 3회 리허설을 다시 수행한다.

---

## 15. 최종 완료 정의

다음을 모두 만족해야 MVP 완료다.

- AC-01~AC-28 검증 완료
- 필수 자동 검증 명령 모두 성공
- Production 배포 성공
- 관리자·Cron 비밀값이 저장소와 클라이언트 번들에 노출되지 않음
- 원본 리뷰와 분석 결과가 분리 저장됨
- 점수와 조정 근거가 UI에서 설명 가능함
- 마지막 정상 결과와 발표 백업 모드가 동작함
- 발표 흐름 3회 연속 성공
