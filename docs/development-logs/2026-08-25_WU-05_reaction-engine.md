# [WU-05] counted-only 집계·방문 검증·moderation 엔진

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-05 |
| 상태 | 완료 |
| 작업일 | 2026-08-25 |
| 담당 | B1 |
| 대상 AC | AC-03~14 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-03, WU-04 fixture |
| 다음 작업 단위 | WU-06 또는 B1 후속 WU-09 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 원본 반응에서 공개 가능한 행만 원자적으로 집계하고, 방문 증명과 moderation 실패가 마지막 정상 projection을 훼손하지 않게 한다.
- 세션 범위: counted-only summary, 방문 proof 판정, moderation 전이·감사 이벤트, 실패 rollback.
- 완료 조건: AC-03~14의 WU-05 엔진 범위와 실패·복구 테스트가 원격에서 통과한다.
- 범위 밖 항목: Auth HTTP API(WU-09), 브라우저 위치 route(WU-10), 운영 rate-limit 큐(WU-11).

## 2. 무엇을 만들었는가

- checkpoint 1: 식당별 advisory lock, active+`counted` 필터, summary upsert, 반응 변경 trigger를 구현했다.
- checkpoint 2: 버전 설정, Haversine 거리·정확도 판정, 24시간 만료 계산, proof 상태·소유권·재사용 판정과 원자 소비 함수를 구현했다.
- checkpoint 3: 중립적 위험 신호 분류, 허용 상태 전이, proof 소비·summary·감사 이벤트의 단일 transaction 적용을 구현했다.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 로컬 Docker와 Supabase CLI access token이 없어 원격 migration 이력을 만들지 않는 checkpoint 검증 경로가 필요했다.

## 4. 어떻게 해결했는가

- checkpoint 1: 서로 다른 식당은 막지 않는 transaction advisory lock과 단일 upsert를 사용했다. 함수는 `private` schema에 두고 클라이언트 실행 권한을 제거했다.
- 완성 전 migration을 원격 이력에 올리지 않고 migration+pgTAP을 하나의 원격 transaction에서 실행한 뒤 rollback했다.
- checkpoint 2: 원본 위치는 함수 인자에서만 계산하고, DB에는 proof digest·검증/만료/사용 시각만 남겼다.
- checkpoint 3: 행동 위험 신호는 `held`, proof 소유권·재사용 무결성 실패는 `rejected`로 제한했다. 상태·projection·감사 이벤트 중 하나라도 실패하면 한 statement 전체가 rollback되도록 구성했다.

## 5. 테스트와 검증

- checkpoint 1 원격 rollback 검증: pgTAP 16번까지 성공, counted insert·kind 변경·held 제외·잘못된 counted 실패·마지막 정상 projection 보존 확인.
- checkpoint 2 원격 rollback 검증: pgTAP 35번까지 성공, 120m·100m·24시간 경계와 proof 소유권·상태·만료·재사용·비변경 실패 확인.
- checkpoint 3 원격 rollback 검증: pgTAP 59번까지 성공, 단일 신호 hold·proof 무결성 reject·허용 전이·감사 append-only·실패 시 마지막 정상 projection 보존 확인.
- 각 checkpoint 검증 후 WU-05 객체 미존재, 기존 WU-04 proof 22건·최대 counted 12건 summary 유지 확인.
- 완성 migration `20260825062147_wu_05_reaction_engine`을 `Be-jarvis` 프로젝트에 적용하고 migration history와 로컬 파일명을 일치시켰다.
- 적용 후 WU-05 pgTAP 59/59, WU-04 fixture 22/22, seed 2회 멱등 적용, 익명 공개·사용자 소유 RLS, counted-only 전체 projection 일치를 확인했다.
- `check:env`, ESLint, TypeScript, Vitest 16/16, Next.js production build가 모두 성공했다.

## 6. 변경된 파일

- `supabase/migrations/20260825062147_wu_05_reaction_engine.sql`
- `supabase/tests/wu_05_reaction_engine_test.sql`
- `docs/DEVELOPMENT_PRIORITY.md`
- `docs/development-logs/INDEX.md`
- `docs/development-logs/2026-08-25_WU-05_reaction-engine.md`

## 7. 남은 위험과 미해결 항목

- Supabase security advisor의 기존 프로젝트 설정 경고인 leaked password protection 비활성화가 남아 있다. 실제 비밀번호 Auth를 연결하는 WU-09 또는 보안 게이트 WU-17 전에 [공식 설정 가이드](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)에 따라 활성화한다.
- performance advisor의 unused index 7건은 합성 데이터만 있는 현재 사용량에서 발생한 INFO다. WU-15 실제 쿼리 통합 후 사용 통계를 보고 유지·삭제를 결정한다.
- 브라우저 Auth·체크인 route와 운영 rate limit·위험 신호 생성은 각각 WU-09~11 범위다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. WU-06은 공개 summary의 `like_count`, `okay_count`, `dislike_count`, `counted_total`만 mock UI에 노출하고 숫자 품질점수를 만들지 않는다.
2. B1 후속 WU-09는 WU-08 완료 뒤 Auth·반응 endpoint를 이 private 엔진에 연결한다.
3. WU-10은 원본 좌표를 저장하지 않고 `evaluate_location_checkin`의 결과로 proof token만 생성한다.
4. WU-11은 행동 신호를 `decide_reaction_moderation`에 전달하되 신호 하나로 계정을 사기라고 단정하지 않는다.

## 9. 세션 업데이트

### 2026-08-25 — checkpoint 1

- 추가 구현: counted-only summary 함수와 자동 refresh trigger.
- 새 문제 또는 막힘: 로컬 Docker·CLI access token 부재.
- 해결 또는 시도: 짧은 transaction, 식당별 advisory lock, 최소 함수 권한, 원격 rollback 테스트 적용.
- 검증 결과: checkpoint 1 pgTAP 16번까지 성공, rollback과 기존 seed 보존 확인.
- 현재 재개 지점: checkpoint 2 방문 proof 판정 구현.

### 2026-08-25 — checkpoint 2

- 추가 구현: `p0-v1`의 120m·100m·24시간 설정, 위치 판정, proof 상태·소유권·만료·원자 소비 함수.
- 새 문제 또는 막힘: 없음.
- 해결 또는 시도: 원본 좌표를 함수 인자로만 사용하고 DB에는 파생 시각·digest만 유지.
- 검증 결과: 원격 rollback pgTAP 35번까지 성공. migration 미적용과 기존 seed summary·proof 보존 확인.
- 현재 재개 지점: checkpoint 3 moderation 상태 전이와 감사 이벤트.

### 2026-08-25 — checkpoint 3

- 추가 구현: 위험 신호 결정 함수와 제한된 moderation 상태 전이·감사·원자 rollback 함수.
- 새 문제 또는 막힘: 테스트 계획 수가 실제 assertion보다 4개 적었다.
- 해결 또는 시도: 단일 행동 신호는 hold, proof 무결성 실패만 reject, 모든 변경은 append-only 이벤트와 한 transaction으로 처리.
- 검증 결과: 테스트 계획을 59개로 맞춘 뒤 원격 rollback pgTAP 59/59 성공. 실패한 감사 FK가 반응 상태와 counted-only projection까지 함께 원복하는 것을 확인했다.
- 현재 재개 지점: checkpoint 4 전체 migration 적용·advisor·회귀.

### 2026-08-25 — checkpoint 4

- 추가 구현: 완성 migration 원격 적용, 이력 정렬, seed·RLS·projection 회귀와 완료 문서 동기화.
- 새 문제 또는 막힘: 연결 도구가 적용 시점의 version `20260825062147`을 생성해 최초 CLI 파일명 `20260825060116`과 달라졌다. 비대화형 `pnpm test`는 의존성 디렉터리 재구성 확인을 요구해 중단됐다.
- 해결 또는 시도: 원격 migration 이력을 기준으로 로컬 파일명을 `20260825062147`로 맞추고 SQL 내용은 그대로 보존했다. 설치나 lockfile 변경 없이 저장소의 고정 Node runtime으로 각 품질 도구를 직접 실행했다.
- 검증 결과: WU-05 59/59, WU-04 22/22, seed 2회, 공개·소유 RLS, projection 전체 일치, 환경 7키, ESLint, TypeScript, Vitest 16/16, production build 성공. 생성된 `public` TypeScript 타입은 기존 파일과 완전히 동일했다.
- 현재 재개 지점: WU-06 공개 지도 셸과 mock 반응·매칭 UI.
