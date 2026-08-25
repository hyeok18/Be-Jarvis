# [WU-10] 위치 체크인 방문 증명

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-10 |
| 상태 | 완료 |
| 작업일 | 2026-08-25 |
| 담당 | B1 |
| 대상 AC | AC-07, AC-08, AC-13 중 방문 토큰 재사용 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-03, WU-05, WU-09 |
| 다음 작업 단위 | WU-11 rate limit·위험 신호·보류 큐 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 로그인 사용자가 동의한 위치 체크인으로 단기 방문 proof를 발급받고 반응에 한 번만 사용하되 원본 위치를 보존하지 않는다.
- 세션 범위: 120m·정확도 100m·24시간 판정, digest 기반 proof 발급·소비, 반응 공개 전환, 브라우저 권한·실패 UI.
- 완료 조건: 정상 체크인이 `counted` 반응으로 이어지고 권한 거절·정확도 부족·거리 초과·만료·재사용이 공개 집계를 바꾸지 않으며 품질 게이트가 통과한다.
- 범위 밖 항목: 계정·네트워크 rate limit과 행동 위험 신호 생성(WU-11), 영수증·QR 등 단계 상승 증명(P1).

## 2. 무엇을 만들었는가

- 구현 또는 문서화한 내용: service-role 전용 위치 proof 발급·반응 승격 RPC, 임의 토큰의 SHA-256 digest 저장, 120m·정확도 100m·24시간·일회 소비 검증, 인증 Route Handler, 사용자 클릭 기반 geolocation UI를 구현했다.
- 사용자 또는 시스템 동작 변화: 로그인 사용자는 식당 상세에서 위치 체크인을 실행하고 성공한 proof를 다음 한 번의 반응에 사용할 수 있다. 증명 없는 반응은 계속 로컬·서버 `private_only`로 남고, 유효 proof를 원자 소비한 반응만 `counted`가 된다.

변경한 파일:

- `supabase/migrations/20260825115028_wu_10_location_visit_proof.sql`
- `supabase/tests/wu_10_location_visit_proof_test.sql`
- `src/app/api/visits/check-in/route.ts`
- `src/server/visits/visit-proof-api.ts`
- `src/server/visits/visit-proof-token.ts`
- `src/server/reactions/reaction-api.ts`
- `src/components/restaurant-detail/visit-check-in.ts`
- `src/components/restaurant-detail/reaction-selector.tsx`
- `src/components/restaurant-detail/reaction-submit.ts`
- `src/app/restaurants/[id]/page.tsx`
- `src/app/globals.css`
- `src/lib/supabase/database.types.ts`
- `tests/visit-proof-api.test.ts`
- `tests/visit-check-in.test.ts`
- `tests/reaction-api.test.ts`
- `tests/reaction-auth-ui.test.ts`
- `tests/restaurant-detail.test.tsx`
- `README.md`
- `docs/DEVELOPMENT_PRIORITY.md`
- `docs/development-logs/INDEX.md`
- `docs/development-logs/2026-08-25_WU-10_location-checkin.md`

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: Supabase CLI 프로필 쓰기 차단, pgTAP plan 불일치, Vitest 별칭 해석, React purity lint, 브라우저 검증 CLI 부재가 순서대로 발생했다.
- 막힌 지점: migration 생성, DB checkpoint 완료 판정, 서버 테스트 import, 클라이언트 만료 예측, 최종 실제 화면 검사.
- 영향: 각 checkpoint에서 해결했고 필수 구현·테스트·DB 적용에는 남은 차단이 없다. 실제 사용자의 정밀 위치 전송은 수행하지 않았다.

## 4. 어떻게 해결했는가

- 원인: 도구별 sandbox·module resolution·최신 DOM 타입 차이와 렌더 중 비결정 값 금지 규칙이 원인이었다.
- 선택한 해결 방법: 승인된 고정 Supabase CLI만 사용하고, pgTAP plan을 33으로 맞췄다. 서버 내부 import는 상대 경로로 바꾸고, 만료는 클라이언트 시각이 아닌 서버에서만 판정했다. 설치 없는 인앱 브라우저 검증으로 대체했다.
- 다른 선택지를 쓰지 않은 이유: 임의 migration timestamp, raw token DB 전송, 클라이언트 권위 만료 판정, 새 브라우저 패키지 설치는 각각 이력·보안·일관성·lockfile 위험이 있다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 관련 DB 테스트 | 원격 rollback 후 적용, `wu_10_location_visit_proof_test.sql` | 성공 | rollback·적용 후 각각 pgTAP 33/33, 합성 proof 0건 복귀 |
| 관련 단위 테스트 | `vitest run` | 성공 | 전체 98개 통과, live YouTube opt-in 2개 기존 skip |
| 정적 검사 | 환경 계약, ESLint, `tsc --noEmit` | 성공 | 환경 7키, lint·type 오류 0개 |
| 빌드 | Next.js 16.3.2 Turbopack production build | 성공 | `/api/visits/check-in` dynamic route와 상세 SSG 3개 생성 |
| 수동 AC 검증 | 인앱 브라우저 390×844, 1440×900 | 성공 | 반응 버튼 3개, 체크인 안내·비로그인 disabled, overflow·overlay·console 오류 0개 |
| 실패·복구 경로 | 위치·서버 mock과 DB transaction | 성공 | 권한 거절·위치 불가·timeout·정확도·거리·만료·재사용·소유권 불일치에서 공개 projection 불변 |
| Supabase advisor | security·performance advisor | 주의 1건 | RLS/함수 권한 오류 없음; 기존 유출 비밀번호 보호 WARN 1건, 미사용 index INFO 5건 |

- 통과한 AC: AC-07, AC-08, AC-13 중 방문 proof 재사용 차단.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 실제 사용자 위치와 Production 배포를 함께 쓰는 최종 E2E는 정밀 위치 전송 동의가 필요해 실행하지 않았고 WU-19 릴리스 게이트에 남겼다. live YouTube 통합 테스트 2개는 WU-10과 무관한 opt-in 환경이라 기존대로 skip했다.
- 테스트 데이터 안전 확인: DB는 합성 UUID·식당만 사용했고 transaction rollback 후 0건을 확인했다. 브라우저 위치는 mock만 사용했다.
- 비밀값 노출 확인: 없음.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `supabase/migrations/20260825115028_wu_10_location_visit_proof.sql` | Supabase CLI로 생성하고 원격 이력 version에 맞춘 WU-10 schema 변경 진실원본 |
| `supabase/tests/wu_10_location_visit_proof_test.sql` | proof 발급·소비·경계·rollback 33개 검증 |
| `src/server/visits/*`, `src/app/api/visits/check-in/route.ts` | 인증 체크인과 raw token→digest 서버 경계 |
| `src/server/reactions/reaction-api.ts` | proof-aware 반응 RPC와 409 복구 응답 |
| `src/components/restaurant-detail/*`, `src/app/restaurants/[id]/page.tsx` | 사용자 동작 위치 요청·체크인·한 탭 반응 UI |
| `src/app/globals.css` | 체크인 상태와 390px 반응형 스타일 |
| `src/lib/supabase/database.types.ts` | 적용된 WU-10·WU-14 함수 타입 재생성 |
| `tests/visit-proof-api.test.ts`, `tests/visit-check-in.test.ts` | 서버·브라우저 위치 경계와 실패 copy 검증 |
| `tests/reaction-api.test.ts`, `tests/reaction-auth-ui.test.ts`, `tests/restaurant-detail.test.tsx` | 기존 반응·상세 UI proof 회귀 |
| `docs/DEVELOPMENT_PRIORITY.md`, `README.md` | WU-10 완료와 WU-11 다음 상태 반영 |
| `docs/development-logs/INDEX.md` | 완료 일지와 WU-11 재개 지점 연결 |
| `docs/development-logs/2026-08-25_WU-10_location-checkin.md` | 구현·문제·검증·인계 기록 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 실제 OS 위치 권한과 현장 GPS 편차는 합성·mock만으로 완전히 재현할 수 없다. Supabase Auth의 유출 비밀번호 보호가 꺼져 있다는 기존 advisor WARN이 남아 있다.
- 후속 작업 후보: WU-11에서 rate limit과 위험 신호를 proof·반응 명령 앞단에 추가한다.
- 사용자 또는 외부 입력이 필요한 사항: WU-19 현장 E2E에서 실제 위치 전송을 승인한 테스트 계정·기기가 필요하다. 유출 비밀번호 보호는 운영 정책·요금제를 확인한 뒤 Dashboard에서 활성화한다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. WU-11은 WU-05 moderation 설정과 WU-10의 두 Route Handler를 읽고 mutation 전 rate-limit 순서를 확정한다.
2. IP 원문·안정적 fingerprint 없이 계정·일 단위 network hash와 최대 7일 보존을 구현한다.
3. `held/rejected` 감사·운영 복구와 실패 시 마지막 정상 projection 보존을 검증한 뒤 WU-15 선행 조건을 갱신한다.

## 9. 세션 업데이트

### 2026-08-25 — 시작

- 추가 구현: WU-10 상태와 작업 범위·완료 조건을 문서화하고 Supabase CLI로 migration 파일을 생성했다.
- 새 문제 또는 막힘: CLI의 사용자 프로필 telemetry 쓰기가 sandbox에서 차단됐다.
- 해결 또는 시도: 승인된 고정 버전 Supabase CLI 명령만 다시 실행했다.
- 검증 결과: 대상 프로젝트 `Be-jarvis`가 `ap-northeast-2`, `ACTIVE_HEALTHY`임을 읽기 전용으로 재확인했다.
- 현재 재개 지점: proof 발급·소비 SQL과 pgTAP 작성.

### 2026-08-25 — checkpoint 1

- 추가 구현: service-role 전용 위치 proof 발급 함수, digest 기반 proof 반응 승격·원자 소비 함수, 120m·100m·24시간·소유권·만료·재사용 pgTAP을 추가했다.
- 새 문제 또는 막힘: 최초 테스트 계획이 실제 assertion 33개보다 4개 적었다.
- 해결 또는 시도: assertion 목록을 재확인해 plan을 33으로 맞추고 동일 migration+test transaction을 다시 실행했다.
- 검증 결과: 원격 rollback transaction에서 WU-10 pgTAP 33/33이 오류 없이 실행됐고, 직후 함수 미존재·합성 proof 0건으로 rollback을 확인했다.
- 현재 재개 지점: 체크인 Route Handler와 기존 반응 API의 proof token digest 연결.

### 2026-08-25 — checkpoint 2

- 추가 구현: 인증된 `/api/visits/check-in`, 암호학적 임의 토큰 생성·SHA-256 digest 변환, proof-aware 반응 RPC transport와 안전한 오류 응답을 연결했다.
- 새 문제 또는 막힘: Vitest가 서버 파일 내부의 `@/` 별칭을 해석하지 못했고, 함수 자체를 JSON 직렬화한 두 assertion이 `undefined`를 반환했다.
- 해결 또는 시도: 서버 내부 import를 상대 경로로 바꾸고 실제 dependency 호출 인자·HTTP body를 검증하는 assertion으로 정리했다.
- 검증 결과: TypeScript 정적 검사와 체크인·반응 API 테스트 25/25 통과. raw token은 체크인 성공 DTO와 브라우저→서버 요청에만 있고 Supabase RPC에는 digest만 전달됨을 확인했다.
- 현재 재개 지점: 브라우저 geolocation 권한·정확도·거리·만료 안내와 반응 선택 연결.

### 2026-08-25 — checkpoint 3

- 추가 구현: 사용자 동작으로만 실행되는 고정밀 geolocation 요청, 최소 좌표 DTO, 체크인 상태·개인 반응 복구 UI, proof token을 반응 한 번에 연결하는 흐름을 추가했다.
- 새 문제 또는 막힘: React purity lint가 이벤트 내부의 로컬 `Date.now()` 만료 예측도 불안정 렌더 값으로 판정했고, DOM geolocation mock에 최신 `toJSON` 타입이 필요했다.
- 해결 또는 시도: 만료 판정은 권위 있는 서버 검증에만 맡기고 409 복구 안내로 통일했다. 테스트 mock은 전체 위치 payload를 전송하지 않는 상태를 유지하면서 DOM 타입만 충족했다.
- 검증 결과: TypeScript, 수정 TS/TSX ESLint, 브라우저 체크인·API·반응·상세 UI 테스트 50/50 통과. 권한 거절·위치 불가·시간 초과·정확도 부족·거리 초과·만료/재사용 안내를 검증했다.
- 현재 재개 지점: migration 적용, advisor·타입 재생성, 전체 품질 게이트와 실제 브라우저 수동 확인.

### 2026-08-25 — checkpoint 4 (완료)

- 추가 구현: 원격 migration 적용, 원격 version과 로컬 파일명 정렬, DB 타입 재생성, 완료 문서·WU-11 인계를 반영했다.
- 새 문제 또는 막힘: 원격 적용 도구가 CLI 생성 시각과 다른 version `20260825115028`을 만들었고 `agent-browser` 실행 파일이 없었다.
- 해결 또는 시도: SQL은 바꾸지 않고 로컬 migration 파일명만 원격 이력에 맞췄다. 설치 없이 인앱 브라우저로 동일 수동 검증을 수행했다.
- 검증 결과: 적용 후 DB 33/33, 함수 적용·anon/authenticated 직접 실행 차단·합성 proof 0건, advisor, 생성 타입, 환경 7키, lint, typecheck, 전체 98개 테스트, production build가 통과했다. 390/1440px 모두 overlay·overflow·console 오류가 없었다.
- 현재 재개 지점: WU-11 rate limit·위험 신호·보류 큐. PR 병합은 사용자의 지시에 따라 WU-10 완료 뒤 별도 안전 확인 단계에서 진행한다.
