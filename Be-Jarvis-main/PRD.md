# PRD: 반응과 크리에이터 근거로 보는 맛집 지도

## 문서 정보

| 항목 | 내용 |
|---|---|
| 상태 | 팀 인터뷰 3차 반영 — 24시간 MVP 구현 계약 |
| 확정일 | 2026-08-25 |
| 최신 요구 반영 | 2026-08-25 — 별점 폐지, 3단계 반응, 방문 증명, 크리에이터 방문 지도 |
| 대상 지역 | 서울 성수동 |
| 대상 플랫폼 | 반응형 웹 |
| 배포 | Vercel Preview / Production |
| 핵심 기술 | Next.js, TypeScript, Supabase, Kakao Maps, YouTube Data API v3 |

이 문서는 인터뷰에서 확정한 24시간 해커톤 MVP의 구현 계약이다. 기존 별점·종합평점·리뷰 신뢰도·GPT 리뷰 판별 계약은 폐기한다. 구현 중 판단이 충돌하면 이 문서를 우선한다.

---

## 1. 제품 정의

### 한 문장 정의

사용자가 식당에 `좋아요`, `그냥 그래요`, `싫어요` 중 하나만 빠르게 남기고, 내 취향 매칭도와 맛집 탐방 크리에이터의 영상 속 방문 근거를 지도에서 함께 확인하는 성수동 맛집 탐색 서비스다.

### 이번 인터뷰에서 확정한 결정

| 영역 | 결정 |
|---|---|
| 별점 | 0~5 별점, 맛·청결·서비스 다면 별점, 평균 별점을 모두 없앤다. |
| 공개 반응 | `좋아요`, `그냥 그래요`, `싫어요` 세 값의 검증된 건수와 분포만 보여준다. |
| 종합평점 | 종합점수, 보정평점, 리뷰 신뢰도 백분율, 공개 품질순위를 만들지 않는다. |
| 개인화 | 안 먹는 음식, 직접 취향, 밸런스 게임, 과거 반응으로 `나와의 매칭도`를 별도로 계산한다. |
| 크리에이터 | 팀이 선정한 맛집 탐방 채널의 영상 속 식당을 지도에 표시한다. |
| 공신력 신호 | YouTube가 제공한 최신 구독자 수가 큰 채널을 출처 목록에서 먼저 보여준다. 구독자 수를 식당 점수로 합산하지 않는다. |
| 방문 인증 | 영수증을 모든 사용자에게 요구하지 않는다. 위치 체크인을 기본으로 하고 영수증·매장 QR은 선택적인 강화 수단으로 둔다. |
| 어뷰징 | 공개 텍스트 댓글을 P0에서 제외하고, 인증·방문 증명·중복 제한·rate limit·보류 큐를 함께 적용한다. |

### 제품이 하지 않는 주장

- 구독자 수가 크리에이터 발언의 진실성이나 식당 품질을 보장한다고 주장하지 않는다.
- 위치 체크인 하나만으로 실제 식사 사실을 100% 증명한다고 주장하지 않는다.
- 보류된 반응을 댓글알바·반응알바·봇으로 확정하지 않는다.
- 세 반응을 하나의 숫자나 별점으로 환산하지 않는다.
- 외부 플랫폼의 리뷰·댓글·영상·자막을 무단 수집하거나 재게시하지 않는다.

---

## 2. 문제와 해결 전략

### 문제 A — 반응을 남기는 비용이 높다

긴 리뷰나 영수증 첨부를 기본으로 요구하면 대부분의 사용자가 이탈한다. MVP는 로그인 후 한 번 누르는 세 단계 반응만 요구한다. 공개 글 작성란은 만들지 않는다.

### 문제 B — 실제 방문자를 어떻게 구분하는가

단일 수단으로 완전한 방문 증명은 불가능하다. 사용자 마찰과 증명 강도를 분리한 계층형 모델을 사용한다.

| 단계 | 방법 | 사용자 부담 | 공개 반응 반영 | 한계 |
|---|---|---:|---|---|
| 0 | 증명 없음 | 매우 낮음 | 미반영, 개인 취향에만 저장 | 원격·대리 반응 가능 |
| 1 | 현장 위치 체크인 | 낮음 | 기본 반영 후보 | GPS 조작·건물 오차 가능 |
| 2 | 매장 QR/NFC | 낮음 | 반영 후보 | 매장 제휴와 코드 관리 필요 |
| 3 | 영수증·예약·결제 연동 | 높음 | 강화 증명 | 개인정보·연동 비용·이탈 위험 |

P0는 단계 0과 1을 구현한다. 위치 체크인이 어려운 사용자는 반응을 개인 매칭 학습에는 사용할 수 있지만 공개 분포에는 포함하지 않는다.

### 문제 C — 댓글알바·반응알바를 어떻게 막는가

완전 차단 대신 공격 비용을 높이고 의심 반응이 공개 집계에 즉시 섞이지 않게 한다.

1. 공개 반응은 인증 계정과 유효한 방문 증명을 모두 요구한다.
2. 사용자·식당 조합당 현재 반응은 하나만 유지한다.
3. 반응 변경은 허용하되 append-only 감사 이벤트를 남긴다.
4. 짧은 시간 다수 식당 반응, 위치 불일치, 비정상 이동, 새 계정 집중, 동일 네트워크 급증은 보류 신호다.
5. 의심 신호가 있는 반응은 `held`로 두고 공개 집계에서 제외한다.
6. 계정·IP·식당 단위 rate limit과 자동화 방지 도전을 서버에서 적용한다.
7. 위험한 경우에만 매장 QR 또는 영수증 같은 단계 상승 증명을 요청한다.
8. P0에는 공개 자유서술 댓글을 만들지 않아 댓글 복제·홍보 문구 공격면을 제거한다.

---

## 3. MVP 목표와 성공 기준

### 5분 발표 흐름

1. 성수동 지도를 열고 식당별 세 반응 분포를 확인한다.
2. `나와의 매칭` 탭에서 취향 설정 전·후의 매칭도 변화를 확인한다.
3. `크리에이터 방문` 레이어를 켜고 영상으로 확인된 식당과 개별 영상 출처를 본다.
4. 구독자 수가 공개된 채널은 최신 원값 기준으로 큰 채널이 먼저 보이는 것을 확인한다.
5. 현장 체크인 fixture로 방문 증명을 만들고 한 번의 탭으로 반응을 남긴다.
6. 증명 없는 반응과 위험 신호 반응이 공개 집계에 포함되지 않는 것을 확인한다.

### 해커톤 성공 조건

- 동일한 배포 환경에서 위 흐름을 3회 연속 완료한다.
- P0 및 P1 버그가 0개다.
- 공개 화면 어디에도 별점·평균·종합점수·리뷰 신뢰도 숫자가 없다.
- 공개 반응 집계는 `counted` 상태만 사용하며 같은 사용자·식당 중복을 만들지 않는다.
- YouTube API 실패나 데이터 만료 시 출처를 오래된 값으로 확정 노출하지 않는다.
- 지도 실패 시 목록·주소·반응·영상 링크는 계속 사용할 수 있다.

### 핵심 사용자

#### 일반 사용자

- 로그인 없이 지도, 검증된 반응 분포, 크리에이터 방문 근거를 본다.
- 로컬 취향 설정 후 나와의 매칭도를 본다.
- 로그인하면 반응을 한 번에 남길 수 있다.
- 위치 체크인을 완료하면 반응이 공개 집계 후보가 된다.
- 위치 증명이 없으면 반응은 내 취향 기록에만 사용된다는 안내를 받는다.

#### 관리자

- Supabase Auth의 관리자 계정으로 로그인한다.
- 크리에이터 채널 allowlist와 영상 후보를 관리한다.
- 영상이 특정 식당을 소개하는지 원본 링크·시점으로 확인한다.
- 보류 반응과 동기화 실패를 확인한다.
- 발표용 합성 fixture와 백업 스냅샷을 관리한다.

---

## 4. 범위

### P0 필수 범위

- 성수동 식당 30곳 기본 정보와 Kakao 지도 마커
- 식당별 `좋아요`·`그냥 그래요`·`싫어요` 검증 반응 건수·분포
- 별점·종합평점·리뷰 신뢰도·공개 품질순위 완전 제거
- 로그인 없는 브라우저 로컬 취향 프로필과 나와의 매칭도
- 안 먹는 음식 hard exclusion, 밸런스 게임, 직접 취향 입력
- Supabase Auth 기반 일반 사용자 로그인과 한 번 탭 반응
- 위치 체크인 기반 방문 증명 토큰
- 증명 없는 반응의 개인 전용 처리
- 사용자·식당당 한 개 현재 반응과 변경 감사 기록
- rate limit, 위험 신호, `pending/counted/held/rejected/private_only` 상태
- 팀이 선정한 맛집 탐방 YouTube 채널 allowlist
- YouTube Data API 기반 채널·영상 메타데이터 동기화
- 영상-식당 후보와 관리자 수동 확인
- 확인된 개별 영상 출처의 지도 표시와 YouTube 링크
- 최신 구독자 수 원값 표시와 큰 값 우선 정렬
- 구독자 수 숨김·만료·영상 삭제 상태 처리
- 관리자 동기화 로그와 수동 재시도
- 매일 03:00 KST 메타데이터 새로고침 Cron
- 모바일·데스크톱 반응형 UI와 지도 fallback
- Vercel Preview 및 Production 배포

### P1 선택 범위

- 매장 QR/NFC 방문 증명
- 영수증 OCR 또는 예약·결제 제휴 증명
- 의심 사용자에게만 단계 상승 증명 요청
- 보류 반응 관리자 검토·복구 UI
- 계정 기반 취향 동기화와 여러 기기 지원
- 충분한 검증 반응이 쌓인 뒤 유사 사용자 매칭 실측 개선

### MVP 제외 범위

- 모든 형태의 별점과 종합점수
- 공개 자유서술 리뷰·댓글과 댓글 대댓글
- 별점 기반 공개 랭킹
- 구독자 수를 변환한 자체 공신력 점수 또는 식당 신뢰도 점수
- YouTube HTML 크롤링, 영상·자막 다운로드, 댓글 수집
- 네이버·카카오·구글 외부 리뷰 크롤링
- 방문 사실·광고·협찬·조작 여부의 확정 판정
- 전국 서비스, 결제, 광고 판매, 네이티브 앱

---

## 5. 공개 반응 계약

### 허용 값

```text
like     = 좋아요
okay     = 그냥 그래요
dislike  = 싫어요
```

- 값은 정확히 셋 중 하나여야 한다.
- 반응에 1~5 숫자를 대응시키지 않는다.
- 세 값을 합쳐 평균, 총점, 별점 또는 긍정점수를 만들지 않는다.
- UI는 각 건수와 전체 검증 반응 중 비율을 함께 보여줄 수 있다.

```text
각 반응 비율 = 해당 반응의 counted 건수 / 전체 counted 건수 × 100
```

비율은 분포 표시용이며 식당의 단일 평가점수가 아니다. 전체가 0이면 세 비율을 0으로 만들지 않고 `아직 방문 인증 반응이 없어요`를 표시한다. 검증 반응이 10개 미만이면 `반응 모으는 중`을 함께 표시한다.

### 공개 집계 포함 조건

다음을 모두 만족할 때만 공개 분포에 포함한다.

- 로그인한 사용자다.
- 해당 식당과 일치하는 유효 방문 증명이 있다.
- 현재 moderation 상태가 `counted`다.
- 해당 사용자·식당 조합의 최신 활성 반응이다.
- 삭제 요청 또는 관리자 비활성화 상태가 아니다.

반응을 바꾸면 현재 행은 갱신하고 이전 값은 감사 이벤트에 남긴다. 공개 집계 transaction이 실패하면 마지막 정상 projection을 유지한다.

---

## 6. 방문 증명 계약

### P0 위치 체크인

1. 사용자가 식당 상세에서 `방문 체크인`을 누른다.
2. 브라우저가 사용자 동의 후 현재 위치와 정확도를 서버로 한 번 전송한다.
3. 서버는 식당 좌표와의 거리, 위치 정확도, 시각, 재사용 여부를 검증한다.
4. 기본 기준은 거리 120m 이내, 위치 정확도 100m 이하이다.
5. 성공하면 해당 사용자·식당에 24시간 유효한 일회성 방문 증명 토큰을 만든다.
6. DB에는 성공 여부, 증명 방식, 시각, 만료 시각, 재사용 방지 digest만 저장한다.
7. 원본 위도·경도와 브라우저 전체 위치 응답은 저장하거나 로그에 남기지 않는다.

기준값은 버전 설정으로 관리한다. 위치 조작 가능성이 있으므로 UI에는 `위치 기반 방문 확인`이라고 표시하고 `실제 식사 보장`이라고 표현하지 않는다.

### 영수증을 기본값으로 사용하지 않는 이유

- 사진 촬영·업로드·OCR은 반응 완료율을 떨어뜨린다.
- 결제 금액, 카드 정보 일부, 시각 등 추가 개인정보가 포함될 수 있다.
- P0는 위치 체크인으로 마찰을 낮추고, 위험 신호가 있거나 위치를 사용할 수 없는 경우에만 P1 선택 수단으로 검토한다.

### 실패·복구 경로

| 실패 | 사용자 처리 | 공개 처리 |
|---|---|---|
| 위치 권한 거부 | 반응은 개인 취향에 저장 가능 | `private_only` |
| 정확도 부족 | 잠시 후 재시도 안내 | 공개 미반영 |
| 거리 초과 | 식당 근처에서 다시 체크인 안내 | 공개 미반영 |
| 토큰 만료 | 새 체크인 안내 | 공개 미반영 |
| 서버 오류 | 반응 선택값을 로컬에 임시 보존 | 마지막 공개 집계 유지 |

---

## 7. 반응 어뷰징 방지 계약

### 최소 방어선

- Supabase Auth 인증 없이는 서버 공개 반응을 생성하지 않는다.
- DB unique 제약으로 `(user_id, restaurant_id)` 현재 반응을 하나로 제한한다.
- 반응 생성·변경은 서버 경로에서 방문 토큰과 제한을 검증한다.
- 자기 소유 반응만 조회·변경하도록 RLS를 적용한다.
- IP 원문은 저장하지 않는다. rate limit에 필요한 경우 일 단위 salt hash를 최대 7일만 보관한다.
- 안정적인 브라우저 지문을 만들거나 광고 추적용 식별자를 사용하지 않는다.

### 위험 신호

| 코드 | 의미 | 기본 처리 |
|---|---|---|
| `RATE_LIMITED` | 계정·네트워크 요청 한도 초과 | `held` |
| `VISIT_PROOF_MISMATCH` | 사용자·식당·토큰 불일치 | `rejected` |
| `DUPLICATE_PROOF` | 같은 방문 증명 재사용 | `rejected` |
| `IMPOSSIBLE_TRAVEL` | 짧은 시간에 불가능한 거리 이동 | `held` |
| `REACTION_BURST` | 짧은 시간 다수 식당 반응 | `held` |
| `ACCOUNT_CLUSTER` | 신규 계정 반응이 한 식당에 집중 | `held` |

- 하나의 신호만으로 알바나 봇이라고 단정하지 않는다.
- `held`는 공개 집계에서 제외하되 원본 이벤트를 삭제하지 않는다.
- 임계값과 조치 버전을 기록하고, 해제·거절은 감사 로그를 남긴다.
- 위험한 계정에만 CAPTCHA, 재인증, 매장 QR 같은 단계 상승을 요청한다.

---

## 8. 나와의 매칭도

공개 반응 분포와 나와의 매칭도는 별개다. 공개 반응을 숫자 품질점수로 변환해 매칭에 섞지 않는다.

1. `excluded_food_tags`와 식당 음식 태그가 겹치면 기본적으로 후보에서 제외한다.
2. 취향 적합도는 맵기·단맛·담백함·풍미·가격 민감도·청결 중시·서비스 중시 축의 거리로 0~100을 계산한다.
3. 유사 사용자 적합도는 같은 식당에 남긴 반응이 5곳 이상 겹칠 때만 사용한다.
4. 방문 이력 적합도는 본인 반응 이력이 있을 때 개인 결과에만 사용한다.
5. 사용할 수 없는 신호의 비중은 0으로 처리하지 않고 사용 가능한 신호끼리 재정규화한다.

```text
나와의 매칭도 = 취향 적합도 × 0.50
               + 유사 사용자 적합도 × 0.30
               + 내 방문 이력 적합도 × 0.20
```

초기 사용자는 취향 적합도만 100% 사용한다. `나와의 매칭순위`는 매칭도 내림차순이며 공개 품질순위가 아니다. 화면에는 실제 사용한 근거 1~3개를 함께 보여준다.

P0 취향 데이터와 공개 집계에 미반영된 개인 반응은 브라우저 로컬에만 저장한다. 계정 동기화를 시작할 때 사용자 소유 RLS·삭제·초기화 기능을 먼저 구현한다.

---

## 9. 크리에이터 방문 지도

### 데이터 수집 원칙

YouTube 페이지 HTML을 크롤링하지 않는다. YouTube Data API v3로 공개 메타데이터만 읽는다.

1. 관리자가 맛집 탐방 채널을 allowlist에 등록한다.
2. 채널의 uploads playlist와 `playlistItems.list`로 새 영상을 증분 조회한다.
3. `videos.list`와 `channels.list`로 영상·채널 메타데이터를 가져온다.
4. 제목·설명에 있는 식당명 후보를 Kakao 장소와 매칭한다.
5. 자동 후보는 공개하지 않고 관리자가 영상 원본과 필요한 경우 시점을 확인한다.
6. 확인된 `영상-식당` 근거만 지도에 표시한다.
7. YouTube 출처와 원본 링크를 명확히 유지한다.

### 구독자 수와 공신력 표시 규칙

- 팀 결정에 따라 구독자 수를 크리에이터 출처의 공신력·영향력 신호로 사용한다.
- YouTube API가 제공한 최신 `subscriberCount` 원값을 그대로 보여주고, 개별 출처 목록에서 큰 값이 먼저 오게 한다.
- 구독자 수는 YouTube 정책에 따라 세 자리 유효숫자로 내림된 값일 수 있다.
- `hiddenSubscriberCount = true`이면 `구독자 수 비공개`로 표시하며 0으로 취급하지 않는다.
- 구독자 수를 로그 변환하거나 자체 0~100 공신력 점수로 만들지 않는다.
- 여러 채널의 구독자 수를 합산해 식당 점수·순위·배지를 만들지 않는다.
- 각 영상 출처는 개별 카드로 보여주고 다른 채널 데이터와 합성하지 않는다.
- 이 신호는 채널의 대중적 영향력을 나타낼 뿐 식당 품질·협찬 없음·주장의 진실성을 보장하지 않는다.

자체 파생 공신력 지표가 필요해지면 YouTube API Compliance Audit 승인과 정책 검토를 먼저 완료한 별도 작업 단위로 다룬다.

### 최신성·삭제 계약

- 비인가 공개 API 데이터는 최대 30일 안에 새로고침하거나 삭제한다.
- `subscriber_count_fetched_at`, `metadata_fetched_at`, `last_verified_at`을 기록한다.
- 30일을 넘긴 구독자 수는 숫자를 숨기고 `업데이트 필요`로 표시한다.
- 삭제·비공개 영상은 공개 근거에서 즉시 비활성화한다.
- API 오류가 나면 마지막 값을 무기한 확정 노출하지 않고 만료 규칙을 적용한다.

### 확인한 공식 기준

확인일: 2026-08-25

- scraping 금지: <https://developers.google.com/youtube/terms/developer-policies>
- 구독자 수와 숨김 필드: <https://developers.google.com/youtube/v3/docs/channels>
- 비인가 API 데이터 30일 새로고침·삭제: <https://developers.google.com/youtube/terms/developer-policies#e.-handling-youtube-data-and-content>
- API 쿼터: <https://developers.google.com/youtube/v3/determine_quota_cost>

---

## 10. 화면 요구사항

### `/` — 지도 탐색

- 서비스명과 `별점 없이 세 반응만 사용` 고지
- `지도 탐색`, `나와의 매칭`, `크리에이터 방문` 탭
- 음식 카테고리 필터와 현재 조건의 식당 목록
- 식당 카드의 세 반응 건수·분포, 검증 반응 수, `반응 모으는 중` 상태
- 취향 프로필이 있으면 나와의 매칭도와 근거
- 확인된 크리에이터 영상 출처와 최신 구독자 수
- 선택 식당의 Kakao 지도 마커와 주소
- 데이터 기준 시각과 YouTube 메타데이터 기준 시각

기본 탭에는 전체 품질순위를 두지 않는다. 목록 기본 정렬은 지도 거리 또는 식당명처럼 평가 의미가 없는 기준을 사용한다. `나와의 매칭` 탭에서만 개인 매칭도 순서를 사용한다.

### `/preferences`

- 로그인 없이 안 먹는 음식, 5~8개 밸런스 게임, 직접 슬라이더 중 하나로 시작한다.
- 본인 반응 이력을 선택적으로 매칭에 사용한다.
- 저장 전 브라우저 로컬 저장임을 알린다.
- 초기화와 전체 삭제를 제공한다.

### `/restaurants/[id]`

- 식당명, 카테고리, 주소, 지도 위치
- 세 반응 건수와 분포, 검증 반응 수, 데이터 부족 상태
- 나와의 매칭도와 실제 사용 근거
- `좋아요/그냥 그래요/싫어요` 한 번 탭 입력
- 방문 체크인 상태와 공개 반영 여부
- 확인된 크리에이터 영상별 채널명, 영상명, 게시일, 구독자 수, YouTube 링크
- 구독자 수가 공신력 참고 신호일 뿐 품질 보장이 아니라는 고지
- 별점, 평균, 종합점수, 리뷰 신뢰도는 표시하지 않는다.

### `/admin`

- YouTube 채널 allowlist 관리와 새 영상 동기화 로그
- 영상-식당 후보, Kakao 후보, 원본 영상 링크, 확인·거절
- stale·삭제·비공개 영상 상태
- 보류 반응 수와 위험 코드 요약
- 발표용 합성 스냅샷 전환

### 공통 상태와 접근성

- 로딩, 빈 결과, API 오류, 지도 오류, 위치 권한 거부, YouTube stale 상태를 각각 설명한다.
- 390px 모바일에서는 목록과 반응을 먼저 보여주고 지도는 접을 수 있게 한다.
- 모든 반응 버튼은 텍스트와 선택 상태를 제공하며 색상만으로 구분하지 않는다.
- 키보드로 탭, 필터, 반응, 체크인, 영상 링크를 사용할 수 있어야 한다.

---

## 11. 시스템 설계 계약

### 기술 구성

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase Postgres + Auth
- Kakao Maps JavaScript SDK + Kakao 장소 검색 API
- YouTube Data API v3
- Vercel Functions + Vercel Cron

OpenAI는 P0 런타임 의존성이 아니다. 장소명 자동 추출을 나중에 추가하더라도 관리자 확인 전에는 공개하지 않는다.

### 주요 서버 경로

| 경로 | 역할 | 권한 |
|---|---|---|
| `POST /api/visits/check-in` | 위치 기반 방문 증명 | 로그인 사용자 |
| `POST /api/reactions` | 반응 생성·변경·moderation | 로그인 사용자 |
| `GET /api/restaurants` | 안전한 공개 DTO | 공개 |
| `POST /api/admin/creators/sync` | 채널·영상 수동 동기화 | 관리자 |
| `POST /api/admin/creator-visits/[id]/confirm` | 영상-식당 근거 확인 | 관리자 |
| `GET /api/admin/sync-runs` | 동기화 로그 | 관리자 |
| `GET /api/cron/youtube-sync` | 메타데이터 새로고침 | `CRON_SECRET` |

### 핵심 데이터 모델

#### `restaurants`

- 기존 Kakao place ID, 이름, 카테고리, 주소, 좌표에 `food_tags text[]`, `preference_profile jsonb`, `is_active boolean`을 둔다.

#### `visit_proofs`

- `id uuid primary key`, `user_id`와 `restaurant_id` FK
- `method`는 `location_checkin`, `merchant_qr`, `receipt`, `partner_transaction` 중 하나
- `status`는 `verified`, `expired`, `revoked`, `rejected` 중 하나
- `evidence_digest text unique`, `verified_at`, `expires_at`, `used_at`, `created_at`
- 원본 위도·경도, GPS 응답, 영수증 이미지는 저장하지 않는다.

#### `restaurant_reactions`

- `id uuid primary key`, `user_id`, `restaurant_id`, 선택적 `visit_proof_id` FK
- `kind`은 `like`, `okay`, `dislike` 중 하나
- `moderation_status`는 `pending`, `counted`, `held`, `rejected`, `private_only` 중 하나
- `risk_codes text[]`, `is_active`, `created_at`, `updated_at`
- unique: `(user_id, restaurant_id)`

#### `reaction_events`

- bigint identity PK와 `reaction_id`, `actor_user_id` FK
- event는 `created`, `changed`, `held`, `counted`, `rejected`, `deleted` 중 하나
- 변경 전후 kind, reason codes, created_at을 append-only로 저장한다.

#### `restaurant_reaction_summaries`

- `restaurant_id` PK와 `like_count`, `okay_count`, `dislike_count`, `counted_total`, `version`, `updated_at`
- `counted_total = like_count + okay_count + dislike_count` check를 둔다.

#### `creator_channels`

- YouTube channel ID, title, thumbnail URL, nullable subscriber count, hidden flag, fetched_at
- uploads playlist ID, allowlist·active 상태, metadata_fetched_at

#### `creator_videos`

- YouTube video ID, channel FK, title, description excerpt, thumbnail URL, published_at
- privacy status, metadata_fetched_at, active 상태

#### `creator_visit_evidence`

- video와 restaurant FK, `candidate/confirmed/rejected/stale` 상태
- 선택적 영상 시점, 확인 메모, confirmed_by/at, last_verified_at
- unique: `(creator_video_id, restaurant_id)`

#### `youtube_sync_runs`

- 실행 상태, trigger, API 요청 수, 처리 영상 수, 후보 수, 오류 요약, 시작·종료 시각을 기록한다.
- API 키, 원본 응답 전체, 영상 자막·댓글은 저장하지 않는다.

### 인덱스

```text
restaurants(category_name, name) where is_active = true
visit_proofs(user_id, restaurant_id, expires_at desc)
restaurant_reactions(restaurant_id, moderation_status) where is_active = true
reaction_events(reaction_id, created_at desc)
creator_videos(creator_channel_id, published_at desc) where is_active = true
creator_visit_evidence(restaurant_id, status)
youtube_sync_runs(status, started_at desc)
```

모든 외래키 열과 RLS의 `user_id`에 인덱스를 둔다. 공개 집계는 `counted` partial index를 사용한다.

### Supabase 권한

- 공개 schema의 모든 application table에 RLS를 활성화한다.
- `anon`, `authenticated` GRANT와 RLS를 별도 게이트로 검증한다.
- 사용자는 자기 반응과 방문 증명만 읽는다. 직접 공개 상태를 `counted`로 바꿀 수 없다.
- 공개 DTO는 서버 데이터 계층이 식당, reaction summary, 확인된 최신 creator evidence만 선택한다.
- 관리자 판정은 `app_metadata` 또는 서버 allowlist를 사용한다.
- UPDATE 정책은 `USING`과 `WITH CHECK`를 모두 둔다.

### 환경변수

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=
KAKAO_REST_API_KEY=
YOUTUBE_DATA_API_KEY=
CRON_SECRET=
```

YouTube·Supabase·Vercel 키 값은 문서·로그·채팅·Git에 출력하지 않는다. Development·Preview·Production의 변수 이름을 맞추고 값과 Supabase project는 환경별로 분리한다.

### Vercel Cron과 장애 처리

- 매일 03:00 KST: `0 18 * * *` UTC
- 채널별 uploads playlist를 증분 동기화하고 메타데이터를 30일 이전에 새로고침한다.
- 외부 API 호출은 DB transaction 밖에서 수행한다.
- 검증이 끝난 결과만 짧은 transaction으로 공개 상태를 갱신한다.
- 실패하면 기존 확인 근거를 즉시 지우지 않되 30일 만료 규칙을 계속 적용한다.

---

## 12. 수용 기준

| ID | 수용 기준 | 재현 가능한 검증 |
|---|---|---|
| AC-01 | 홈과 상세에 별점·평균·종합점수·리뷰 신뢰도가 없다. | 금지 용어·필드 정적 검사와 화면 확인을 수행한다. |
| AC-02 | 공개 반응 값은 좋아요·그냥 그래요·싫어요 셋뿐이다. | 잘못된 enum 입력을 거부하고 세 버튼을 확인한다. |
| AC-03 | 세 반응의 counted 건수와 분포가 원본 상태와 일치한다. | 고정 fixture로 세 건수·합계·비율을 검증한다. |
| AC-04 | 반응 0개와 10개 미만 상태를 점수 없이 설명한다. | 빈 fixture와 9개 fixture에서 문구를 확인한다. |
| AC-05 | 반응은 공개 텍스트 작성 없이 한 번 탭으로 완료된다. | 상세에서 각 버튼을 선택해 요청 수와 UI를 확인한다. |
| AC-06 | 비로그인 사용자의 반응은 공개 집계에 들어가지 않는다. | 비로그인 POST가 거부되고 summary가 불변인지 확인한다. |
| AC-07 | 방문 증명 없는 반응은 개인 전용이며 공개 집계에 들어가지 않는다. | `private_only` fixture로 summary 불변을 확인한다. |
| AC-08 | 위치 체크인은 기준을 만족하면 24시간 토큰을 만들고 원본 좌표를 저장하지 않는다. | 거리·정확도·만료 경계와 DB·로그 필드 검사를 수행한다. |
| AC-09 | 사용자·식당당 현재 반응은 하나이며 변경 가능하다. | 동일 조합 두 요청이 insert 중복이 아니라 update가 되는지 확인한다. |
| AC-10 | 반응 변경·보류·거절은 append-only 감사 이벤트를 남긴다. | 각 상태 전환 후 이벤트 순서를 확인한다. |
| AC-11 | 공개 summary는 활성 `counted` 반응만 포함한다. | pending·held·rejected·private fixture를 섞어 집계를 검증한다. |
| AC-12 | 위험 신호 반응은 즉시 공개되지 않고 보류된다. | burst·impossible-travel fixture가 `held`인지 확인한다. |
| AC-13 | 계정·네트워크 rate limit과 중복 방문 토큰이 차단된다. | 한도 초과와 재사용 토큰 실패 경로를 확인한다. |
| AC-14 | 집계 또는 외부 API 실패가 마지막 정상 공개 결과를 덮어쓰지 않는다. | 중간 실패 mock 후 활성 projection을 비교한다. |
| AC-15 | 확인된 크리에이터 영상-식당 근거가 지도와 상세에 보인다. | confirmed fixture의 마커·출처·링크를 확인한다. |
| AC-16 | YouTube 데이터는 공식 Data API로만 읽고 HTML scraping을 사용하지 않는다. | 네트워크 클라이언트와 의존성·코드를 정적 검사한다. |
| AC-17 | 최신 구독자 수 원값이 큰 개별 출처가 먼저 보이고 파생 점수가 없다. | 2개 채널 fixture의 정렬·표시와 금지 필드 검사를 수행한다. |
| AC-18 | 숨김 구독자 수는 0이 아니며 30일 초과 데이터는 숫자를 노출하지 않는다. | hidden·fresh·stale fixture를 검증한다. |
| AC-19 | 자동 장소 후보는 관리자 확인 전 공개되지 않는다. | candidate와 confirmed 상태의 공개 DTO 차이를 확인한다. |
| AC-20 | 선호가 있으면 나와의 매칭도와 사용 근거를 볼 수 있다. | 로컬 선호 fixture로 0~100 결과와 근거를 확인한다. |
| AC-21 | 안 먹는 음식은 개인화 후보에서 hard exclusion 된다. | 제외 태그 fixture에서 매칭순위가 없음을 확인한다. |
| AC-22 | cold-start와 신호 부족 시 사용 가능한 신호끼리 재정규화한다. | 유사 사용자 overlap 4·5 경계와 방문 이력 없음 fixture를 검증한다. |
| AC-23 | 카테고리·선택 카드·지도 마커·크리에이터 레이어가 동기화된다. | 필터와 레이어를 바꿔 목록·마커를 비교한다. |
| AC-24 | 지도 실패 시 목록·주소·반응·영상 링크가 유지된다. | Kakao SDK 차단 후 fallback을 확인한다. |
| AC-25 | 390px·1440px와 키보드에서 핵심 흐름을 사용할 수 있다. | 두 viewport와 Tab/Enter 수동 검증을 수행한다. |
| AC-26 | Supabase RLS·GRANT·unique·FK index가 사용자·관리자·공개 경계를 강제한다. | 비로그인·일반·다른 사용자·관리자 SQL/API 테스트와 advisor를 실행한다. |
| AC-27 | Vercel Preview와 Production이 환경 분리와 동일 품질 게이트를 통과한다. | Preview smoke 후 같은 artifact 승격과 rollback 대상을 확인한다. |
| AC-28 | 합성 데이터만으로 전체 발표 흐름이 3회 연속 성공한다. | 실행 시각·fixture 버전·결과를 체크리스트에 세 번 기록한다. |

### 필수 자동 검증

```bash
pnpm run check:env
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

단위 테스트 최소 대상:

- 반응 enum, counted-only 집계, 분포 반올림, 데이터 부족
- 방문 증명 유무에 따른 `counted/private_only/held/rejected`
- 사용자·식당 중복과 방문 토큰 재사용
- 위치 거리·정확도·만료 경계와 원본 위치 비저장
- 크리에이터 candidate·confirmed·stale·hidden 상태
- 최신 구독자 수 원값 정렬과 파생 공신력 점수 부재
- 개인화 hard exclusion, cold-start, 신호 재정규화
- RLS 실패 경로와 마지막 정상 projection 유지

---

## 13. 4인 분업

| 담당 | 주 작업 | 대상 |
|---|---|---|
| A1 | 반응·매칭·상세 UI | AC-01~05, AC-20~22 |
| A2 | Kakao 지도·크리에이터 레이어·반응형 | AC-15, AC-23~25 |
| B1 | Supabase Auth·방문 증명·반응·RLS | AC-06~13, AC-26 |
| B2 | YouTube 동기화·후보 확인·Cron·백업 | AC-14~19, AC-27~28 |

공유 타입과 migration을 먼저 고정한다. 외부 API 없이 합성 fixture로 UI·집계·moderation을 개발하고, YouTube와 Kakao는 서버 어댑터 뒤에 둔다.

---

## 14. 24시간 실행 계획

| 시간 | 목표 | 종료 조건 |
|---:|---|---|
| H0~H2 | 새 계약·타입·migration 합의 | 별점 필드 제거, 반응·방문·creator DTO 고정 |
| H2~H6 | 최소 수직 흐름 | 식당 1곳의 세 반응과 지도 표시, Auth 성공 |
| H6~H12 | 핵심 병렬 구현 | 위치 체크인·반응과 creator fixture 레이어 각각 동작 |
| H12~H16 | 외부 API·DB 통합 | Supabase 집계와 YouTube confirmed evidence 연결 |
| H16~H20 | 어뷰징·동기화·복구 | held 경로, Cron, stale, 백업 완성 |
| H20 | 기능 동결 | 필수 범위 외 신규 기능 금지 |
| H20~H22 | 오류·접근성·Preview | P0/P1 0개, Preview smoke 통과 |
| H22~H24 | Production·발표 리허설 | 전체 흐름 3회 연속 성공 |

---

## 15. 최종 완료 정의

- AC-01~AC-28 검증 완료
- 공개 제품과 활성 코드에 별점·평균·종합점수·리뷰 신뢰도 계약이 없음
- 세 반응은 counted-only 분포로 재현 가능함
- 방문 증명 원본 위치와 비밀값이 저장·로그·Git에 노출되지 않음
- 어뷰징 신호가 원본을 삭제하지 않고 공개 집계에서 격리됨
- YouTube 공식 API·출처 표시·30일 최신성·hidden 처리 조건을 지킴
- 구독자 수는 최신 원값으로만 표시·정렬되고 자체 공신력 점수로 변환되지 않음
- 나와의 매칭도와 hard exclusion이 독립적으로 동작함
- Preview와 Production 배포 및 발표 흐름 3회 연속 성공
