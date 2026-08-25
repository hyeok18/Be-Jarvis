# [WU-09] Auth·반응 생성·변경 백엔드

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-09 |
| 상태 | 진행 중 — 백엔드 독립 범위 완료, WU-08 UI 대기 |
| 작업일 | 2026-08-25 |
| 담당 | B1 |
| 대상 AC | AC-05~07, AC-09~10 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-03, WU-05 완료; WU-08 UI 진행 대기 |
| 다음 작업 단위 | WU-10 위치 체크인 방문 증명 선행 구현 |

## 1. 이번 작업의 목표

- 해결하려는 문제: A1이 WU-06을 구현하는 동안 UI 파일과 충돌하지 않고 WU-09의 DB 반응 명령을 선행 구현한다.
- 세션 범위: 서버 전용 반응 선택 RPC, 사용자·식당당 현재 행 하나, 자동 생성·변경 감사 이벤트, 인증된 HTTP API, 실패 rollback.
- 완료 조건: DB 명령과 HTTP 경계의 생성·변경·중복 요청·권한·RLS·비밀값 비노출·counted projection 연동을 검증한다.
- 범위 밖 항목: WU-08 버튼 연결, 로그인 화면, 위치 proof 발급(WU-10), rate limit(WU-11).

## 2. 무엇을 만들었는가

- `public.save_reaction_selection`: 검증된 서버 사용자 ID만 받는 service-role 전용 RPC.
- 같은 사용자·식당 요청만 직렬화하는 transaction advisory lock.
- 증명 없는 최초 반응의 `private_only` 저장과 동일 선택 재시도의 무이벤트 idempotency.
- `created`와 실제 kind 변경만 append-only로 남기는 자동 감사 trigger.
- 기존 `counted` 반응의 kind 변경 시 WU-05 공개 projection과 감사 이벤트를 한 transaction에서 갱신하는 연동.
- `POST /api/reactions`: Bearer 토큰을 Supabase Auth로 확인하고 검증된 사용자 ID만 RPC에 전달하는 서버 Route Handler.
- `restaurantId`와 `like | okay | dislike`만 받는 좁은 요청 계약과 모든 응답의 `private, no-store` 캐시 정책.
- 새 Supabase secret key를 `apikey`로만 서버 RPC에 전달하고, 토큰·비밀 키·DB 오류 원문을 응답에서 제거하는 전송 계층.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 현재 `supabase-js` 계열은 Node 22 이상을 요구하지만 저장소 계약은 Node 20.9 이상이다. A1 작업 중 `package.json`과 lockfile을 함께 바꾸면 충돌 위험도 있다.
- Supabase CLI가 sandbox 밖 사용자 telemetry 파일을 쓰지 못해 첫 migration 생성 명령이 실패했다.
- CLI의 새 pgTAP 파일에 기본 `plan(1)` template이 남아 처음 원격 쿼리가 실패했다.
- counted fixture를 바로 비활성화하면 기존 DB check constraint를 위반했다.
- 작업 중 공유 작업 폴더가 A1의 `main` 브랜치로 전환되고 다른 변경이 스테이징돼, 그대로 커밋하면 타 담당자 파일을 함께 커밋할 위험이 생겼다.
- 격리 worktree의 `node_modules` junction을 Turbopack이 프로젝트 루트 밖 링크로 판정해 기본 프로덕션 빌드가 중단됐다.
- Supabase security advisor에서 프로젝트의 유출 비밀번호 보호 기능이 꺼져 있다는 Auth 설정 경고가 확인됐다.

## 4. 어떻게 해결했는가

- 첫 checkpoint는 새 npm 의존성 없이 Postgres RPC와 trigger로 제한했다.
- 사용자 승인을 받은 공식 CLI 2.115.0으로 migration·test 파일을 생성했다.
- 기본 pgTAP template을 제거하고 실제 assertion 수 34개로 plan을 맞췄다.
- counted fixture는 먼저 `held`로 전환한 뒤 비활성화해 실제 상태 계약을 지켰다.
- A1의 index와 working tree를 수정하지 않고 `codex/wu-09-backend-prep`를 별도 worktree로 격리했으며, 옮긴 세 파일의 SHA-256 해시 일치를 확인했다.
- A1과 공용 `package.json`·lockfile 충돌을 피하기 위해 새 SDK 의존성을 추가하지 않고 서버 전용 native `fetch` 어댑터와 주입 가능한 handler로 구현했다.
- Turbopack 실패는 동일 소스의 Next.js Webpack 프로덕션 빌드로 재검증해 코드 실패가 아님을 분리했다.
- 실DB migration 목록과 권한·트리거·합성 집계 상태를 읽기 전용 쿼리로 재확인하고 security/performance advisor를 실행했다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| DB migration+pgTAP | 연결된 `Be-jarvis` 프로젝트의 단일 rollback transaction | 성공 | 34/34 |
| 권한 경계 | anon/authenticated/service_role 함수 권한 | 성공 | service_role만 실행 가능 |
| RLS | 합성 사용자 JWT로 소유 반응 조회 | 성공 | 다른 사용자 행 미노출 |
| 실패·복구 | 잘못된 kind·사용자·비활성 식당 | 성공 | 행·이벤트·summary 불변 |
| 기존 데이터 보존 | rollback 후 WU-04 수치 확인 | 성공 | 반응 29개, 최대 counted 12 유지 |
| Route 단위 테스트 | Vitest `tests/reaction-api.test.ts` | 성공 | 13/13 |
| 전체 프런트 회귀 | TypeScript, Vitest, ESLint | 성공 | 최신 `origin/main` 병합 후 테스트 30/30, 오류·경고 없음 |
| 프로덕션 빌드 | `next build --webpack` | 성공 | `/api/reactions` 동적 Route 확인 |
| 비밀값 경계 | Auth·RPC header 및 오류 응답 테스트 | 성공 | secret은 RPC `apikey`에만 사용, 응답 비노출 |
| Supabase 실DB 상태 | migration 목록·metadata·aggregate 조회 | 성공 | WU-09 적용, service_role만 실행, 반응 29·최대 counted 12 |
| Supabase advisor | security·performance advisor | 주의 1건 | RLS 오류 없음; 유출 비밀번호 보호 꺼짐 경고, 미사용 인덱스 INFO |

- 통과한 AC: AC-06, AC-07, AC-09, AC-10의 DB 범위.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 실제 브라우저 로그인 세션과 한 탭 UI AC-05는 WU-08 완료 후 연결해야 한다.
- 테스트 데이터 안전 확인: 합성 UUID와 합성 식당만 사용.
- 비밀값 노출 확인: 없음.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `supabase/migrations/20260825064935_wu_09_reaction_command.sql` | 서버 전용 반응 명령과 감사 trigger |
| `supabase/tests/wu_09_reaction_command_test.sql` | 정상·권한·실패·projection DB 검증 |
| `docs/development-logs/2026-08-25_WU-09_auth-reaction-backend.md` | 구현·문제·검증·인계 기록 |
| `src/app/api/reactions/route.ts` | 인증된 반응 저장 HTTP 진입점 |
| `src/server/reactions/reaction-api.ts` | 요청 검증, Auth 확인, 서버 전용 Supabase RPC 전송 |
| `tests/reaction-api.test.ts` | 인증·입력·상태 코드·비밀값·전송 계층 회귀 테스트 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 실제 Supabase Auth 사용자로 브라우저부터 원격 DB까지 잇는 E2E와 HTTP rate limit은 아직 연결되지 않았다.
- 운영 설정: Supabase Dashboard의 Auth 비밀번호 설정에서 [유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)를 활성화해야 한다.
- 성능 advisor의 미사용 인덱스는 합성 데이터만 있는 초기 상태에서 예상되는 INFO이며, 예정된 반응·크리에이터 조회에 필요하므로 지금 제거하지 않는다.
- 후속 작업 후보: 팀 공용 런타임을 Node 22 이상으로 올리는 시점에 Supabase SSR client 도입 여부를 합의한다.
- 사용자 또는 외부 입력이 필요한 사항: A1의 WU-06·08 완료와 UI request 계약.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. WU-10에서 원본 좌표를 저장하지 않는 단기 방문 proof 발급·소비 계약을 구현한다.
2. WU-08 완료 후 실제 버튼과 Supabase Auth 로그인 흐름을 `/api/reactions`에 연결한다.
3. WU-11에서 반응 rate limit과 위험 신호 보류 처리를 API 경계에 추가한다.

## 9. 세션 업데이트

### 2026-08-25 — checkpoint 1

- 추가 구현: service-role 전용 반응 RPC, 동시성 잠금, 자동 감사 trigger.
- 새 문제 또는 막힘: CLI telemetry 권한, 기본 pgTAP template, counted 비활성화 constraint.
- 해결 또는 시도: 공식 CLI 권한 승인, template 제거, 유효한 상태 전이 fixture 적용.
- 검증 결과: 원격 rollback pgTAP 34/34 및 기존 seed 보존 성공.
- 현재 재개 지점: 서버 Auth/API 경계 구현.

### 2026-08-25 — checkpoint 2

- 추가 구현: 인증된 `POST /api/reactions`, 엄격한 payload 검증, Supabase Auth·RPC 전송 계층, 안전한 오류 응답.
- 보안 경계: publishable key는 Auth 조회에만, secret key는 서버 RPC `apikey`에만 사용하며 응답은 `private, no-store`로 고정.
- 새 문제 또는 막힘: A1이 공유 working tree를 `main`으로 전환해 다른 파일들이 staging된 상태였고, 격리 worktree의 junction을 Turbopack이 거부했다.
- 해결 또는 시도: 별도 worktree로 WU-09 브랜치를 격리하고 SHA-256을 대조했으며, Webpack 프로덕션 빌드로 코드 빌드를 검증했다.
- 검증 결과: 최신 `origin/main` 병합 후 타입·린트 성공, 전체 Vitest 30/30, Route 테스트 13/13, Next.js 프로덕션 빌드 성공.
- 현재 재개 지점: 원격 migration 적용과 advisor·회귀 검사 후 안전 푸시, 이후 WU-10 선행 구현.

### 2026-08-25 — checkpoint 3

- 추가 검증: Supabase plugin으로 `Be-jarvis`의 적용 migration, 함수 권한, 감사 trigger, 집계 보존 상태를 확인했다.
- 검증 결과: WU-09 적용 완료, anon/authenticated 실행 불가, service_role 실행 가능, 반응 29개와 최대 counted 12 유지.
- advisor 결과: RLS·함수 보안 오류 없음. 유출 비밀번호 보호 꺼짐 WARN 1건과 초기 미사용 인덱스 INFO만 확인했다.
- 현재 재개 지점: Git 원격 충돌 검사를 한 번 더 수행하고 WU-09 브랜치를 안전하게 push한다.
