# [WU-09] Auth·반응 생성·변경 백엔드

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-09 |
| 상태 | 진행 중 — WU-08 대기 중 백엔드 선행 구현 |
| 작업일 | 2026-08-25 |
| 담당 | B1 |
| 대상 AC | AC-05~07, AC-09~10 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-03, WU-05 완료; WU-08 UI 진행 대기 |
| 다음 작업 단위 | WU-09 서버 Auth/API 경계 |

## 1. 이번 작업의 목표

- 해결하려는 문제: A1이 WU-06을 구현하는 동안 UI 파일과 충돌하지 않고 WU-09의 DB 반응 명령을 선행 구현한다.
- 세션 범위: 서버 전용 반응 선택 RPC, 사용자·식당당 현재 행 하나, 자동 생성·변경 감사 이벤트, 실패 rollback.
- 완료 조건: DB 명령의 생성·변경·중복 요청·권한·RLS·counted projection 연동을 원격 rollback 테스트로 검증한다.
- 범위 밖 항목: WU-08 버튼 연결, 로그인 화면, 위치 proof 발급(WU-10), rate limit(WU-11).

## 2. 무엇을 만들었는가

- `public.save_reaction_selection`: 검증된 서버 사용자 ID만 받는 service-role 전용 RPC.
- 같은 사용자·식당 요청만 직렬화하는 transaction advisory lock.
- 증명 없는 최초 반응의 `private_only` 저장과 동일 선택 재시도의 무이벤트 idempotency.
- `created`와 실제 kind 변경만 append-only로 남기는 자동 감사 trigger.
- 기존 `counted` 반응의 kind 변경 시 WU-05 공개 projection과 감사 이벤트를 한 transaction에서 갱신하는 연동.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 현재 `supabase-js` 계열은 Node 22 이상을 요구하지만 저장소 계약은 Node 20.9 이상이다. A1 작업 중 `package.json`과 lockfile을 함께 바꾸면 충돌 위험도 있다.
- Supabase CLI가 sandbox 밖 사용자 telemetry 파일을 쓰지 못해 첫 migration 생성 명령이 실패했다.
- CLI의 새 pgTAP 파일에 기본 `plan(1)` template이 남아 처음 원격 쿼리가 실패했다.
- counted fixture를 바로 비활성화하면 기존 DB check constraint를 위반했다.

## 4. 어떻게 해결했는가

- 첫 checkpoint는 새 npm 의존성 없이 Postgres RPC와 trigger로 제한했다.
- 사용자 승인을 받은 공식 CLI 2.115.0으로 migration·test 파일을 생성했다.
- 기본 pgTAP template을 제거하고 실제 assertion 수 34개로 plan을 맞췄다.
- counted fixture는 먼저 `held`로 전환한 뒤 비활성화해 실제 상태 계약을 지켰다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| DB migration+pgTAP | 연결된 `Be-jarvis` 프로젝트의 단일 rollback transaction | 성공 | 34/34 |
| 권한 경계 | anon/authenticated/service_role 함수 권한 | 성공 | service_role만 실행 가능 |
| RLS | 합성 사용자 JWT로 소유 반응 조회 | 성공 | 다른 사용자 행 미노출 |
| 실패·복구 | 잘못된 kind·사용자·비활성 식당 | 성공 | 행·이벤트·summary 불변 |
| 기존 데이터 보존 | rollback 후 WU-04 수치 확인 | 성공 | 반응 29개, 최대 counted 12 유지 |

- 통과한 AC: AC-06, AC-07, AC-09, AC-10의 DB 범위.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: UI 한 탭 AC-05와 HTTP 비로그인 POST는 WU-08 및 다음 checkpoint 의존.
- 테스트 데이터 안전 확인: 합성 UUID와 합성 식당만 사용.
- 비밀값 노출 확인: 없음.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `supabase/migrations/20260825064935_wu_09_reaction_command.sql` | 서버 전용 반응 명령과 감사 trigger |
| `supabase/tests/wu_09_reaction_command_test.sql` | 정상·권한·실패·projection DB 검증 |
| `docs/development-logs/2026-08-25_WU-09_auth-reaction-backend.md` | 구현·문제·검증·인계 기록 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 실제 Auth session 검증과 HTTP rate limit은 아직 연결되지 않았다.
- 후속 작업 후보: Node 22 계약을 팀 공용 의존성 변경 시점에 합의하고 Supabase SSR client를 도입한다.
- 사용자 또는 외부 입력이 필요한 사항: A1의 WU-06·08 완료와 UI request 계약.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. npm 의존성 없이 검증 가능한 `/api/reactions`의 토큰·payload·오류 계약을 먼저 구현한다.
2. 비로그인·잘못된 token·잘못된 kind·성공 RPC 호출을 서버 route 단위 테스트로 검증한다.
3. WU-08 완료 후 실제 버튼과 Supabase Auth 로그인 흐름을 연결한다.

## 9. 세션 업데이트

### 2026-08-25 — checkpoint 1

- 추가 구현: service-role 전용 반응 RPC, 동시성 잠금, 자동 감사 trigger.
- 새 문제 또는 막힘: CLI telemetry 권한, 기본 pgTAP template, counted 비활성화 constraint.
- 해결 또는 시도: 공식 CLI 권한 승인, template 제거, 유효한 상태 전이 fixture 적용.
- 검증 결과: 원격 rollback pgTAP 34/34 및 기존 seed 보존 성공.
- 현재 재개 지점: 서버 Auth/API 경계 구현.

### 2026-08-25 — checkpoint 2

- 추가 구현: bearer token을 Supabase Auth로 검증하고 service-role 전용 RPC를 호출하는 `/api/reactions` POST 경계.
- 보안 경계: publishable key는 Auth 조회에만, secret key는 서버 RPC에만 사용하며 응답은 `private, no-store`로 고정.
- 검증 결과: 환경 계약, lint, typecheck, API 포함 28개 테스트, production build 통과.
- 현재 재개 지점: WU-08 로그인·반응 UI에서 `/api/reactions`를 호출하고 실제 세션 흐름을 검증.
