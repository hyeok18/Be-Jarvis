# [WU-11] rate limit·위험 신호·보류 큐

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-11 |
| 상태 | 완료 |
| 작업일 | 2026-08-25 |
| 담당 | B1+B2 |
| 대상 AC | AC-11~14 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-05, WU-10 |
| 다음 작업 단위 | WU-15 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 인증된 반응·체크인 요청의 계정/네트워크 과다 요청과 이상 패턴을 공개 집계 전에 제한·격리한다.
- 세션 범위: WU-11 DB migration, server-only rate guard, 반응·체크인 API 연결, 테스트와 Supabase 검증.
- 완료 조건: AC-11~14 구현·검증과 작업 우선순위/인덱스 문서 동기화. 완료.
- 범위 밖 항목: P1 관리자 held 검토 UI, 영수증 OCR, 자유 텍스트 댓글, WU-13 관리자 화면.

## 2. 무엇을 만들었는가

- private schema에 1시간 계정·네트워크 bucket, 최대 7일 보존 observation, 버전 관리 config를 추가했다.
- Vercel의 x-vercel-forwarded-for 값은 서버에서 UTC 일자와 server-only salt를 포함한 HMAC-SHA256으로 변환했다. 원 IP와 브라우저 fingerprint는 저장·로그·DB 전송하지 않는다.
- /api/reactions, /api/visits/check-in은 Auth 성공 뒤, 각각의 DB mutation 전에 guard를 실행한다. 한도를 넘으면 429와 Retry-After만 반환하고 반응·방문 증명은 만들지 않는다.
- REACTION_BURST, ACCOUNT_CLUSTER, IMPOSSIBLE_TRAVEL은 valid location proof 반응을 held로 연결한다. 기존 moderation·감사 이벤트·counted-only summary를 재사용하므로 held는 공개 분포에 포함되지 않는다.
- Supabase performance advisor가 보고한 observation 식당 FK 인덱스를 후속 migration으로 보완했고, 원격 DB 타입에 enforce_reaction_abuse_guard RPC를 반영했다.

변경한 파일:

- supabase/migrations/20260825134258_wu_11_abuse_controls.sql
- supabase/migrations/20260825134404_wu_11_advisor_index.sql
- supabase/tests/wu_11_abuse_controls_test.sql
- src/server/abuse/abuse-guard-api.ts
- src/server/reactions/reaction-api.ts
- src/server/visits/visit-proof-api.ts
- src/app/api/reactions/route.ts
- src/app/api/visits/check-in/route.ts
- src/lib/supabase/database.types.ts
- .env.example, scripts/check-env-contract.mjs
- 관련 Vitest 파일 3개

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: 공개 API에서 전달받은 일반 x-forwarded-for를 신뢰하면 로컬/프록시 환경에서 위조 가능성이 있다.
- 막힌 지점: 이 노트북에는 Docker가 없어 supabase test db가 로컬 Postgres 127.0.0.1:54322에 연결하지 못했다.
- 영향: 로컬 컨테이너 기반 DB 테스트는 실행하지 못했다. 원격 rollback DB 테스트로 동작 계약을 검증했다.

## 4. 어떻게 해결했는가

- 원인: Vercel 요청 헤더와 로컬 프록시 헤더의 신뢰 경계가 다르다.
- 선택한 해결 방법: Vercel runtime(VERCEL=1)에서만 x-vercel-forwarded-for를 받고, 누락·다중 주소·비Vercel 런타임은 fail-closed 처리했다. 테스트는 inject 가능한 guard dependency를 사용한다.
- 다른 선택지를 쓰지 않은 이유: raw IP 저장, 지속 fingerprint, 클라이언트가 임의로 보낸 헤더 사용은 PRD/AGENTS 개인정보·보안 계약에 맞지 않는다.
- DB 테스트는 원격 Be-jarvis 프로젝트에서 BEGIN ... ROLLBACK으로 18개 pgTAP 검증을 실행했다. 합성 사용자·식당·반응은 롤백됐고 재확인 결과 잔존 사용자 수는 0이었다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 관련 단위 테스트 | pnpm test | 성공 | 19 파일 중 17 성공, 2 skip, 108 tests 성공 |
| DB 계약 테스트 | 원격 BEGIN ... WU-11 pgTAP ... ROLLBACK | 성공 | 18/18 성공, 테스트 데이터 잔존 0 |
| 로컬 DB 테스트 | pnpm run test:db | 미실행 | Docker/Supabase local stack 미기동으로 연결 실패 |
| 정적 검사 | pnpm run lint, pnpm run typecheck | 성공 | 오류 0 |
| 환경 계약 | pnpm run check:env | 성공 | server-only RATE_LIMIT_NETWORK_SALT 포함 8개 key |
| 빌드 | pnpm run build | 성공 | Next.js 16.3.2 production build 성공 |
| 수동 AC 검증 | Supabase migration/권한 조회 | 성공 | private 3 tables RLS, anon/auth RPC execute false, service_role true, 금지 컬럼 0 |
| 실패·복구 경로 | API mock 및 DB held 테스트 | 성공 | 429은 mutation 전 종료, guard 오류는 secret/IP 비노출 503, held summary 0 유지 |

- 통과한 AC: AC-11, AC-12, AC-13, AC-14.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: Docker 부재로 로컬 supabase test db만 미실행. 동등한 원격 rollback pgTAP 검증은 성공했다.
- 테스트 데이터 안전 확인: 원격 테스트는 transaction rollback 후 합성 user 잔존 0을 확인했다.
- 비밀값 노출 확인: 없음.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| supabase/migrations/20260825134258_wu_11_abuse_controls.sql | private rate bucket·observation·guard RPC·held 연결 |
| supabase/migrations/20260825134404_wu_11_advisor_index.sql | observation restaurant FK advisor 보완 |
| supabase/tests/wu_11_abuse_controls_test.sql | rate limit, cluster, burst, travel, held, summary 보존 계약 |
| src/server/abuse/abuse-guard-api.ts | Vercel daily HMAC 및 RPC transport |
| src/server/reactions/reaction-api.ts | reaction mutation 전 guard·429·fail-closed |
| src/server/visits/visit-proof-api.ts | proof token 생성 전 guard·429·fail-closed |
| src/app/api 경로 파일 | server-only guard dependency 조립 |
| .env.example, scripts/check-env-contract.mjs | Vercel server-only salt 계약 |
| src/lib/supabase/database.types.ts | 적용한 RPC의 생성 타입 |
| tests 경로 파일 | HMAC, transport, API mutation 순서와 비밀값 비노출 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: RATE_LIMIT_NETWORK_SALT를 Vercel Preview/Production server-only 환경변수로 설정하기 전에는 실제 배포 요청이 fail-closed 된다.
- 후속 작업 후보: WU-15 DB→공개 지도·상세 UI 실제 연결, P1 관리자 held 검토·복구 흐름.
- 사용자 또는 외부 입력이 필요한 사항: 없음. WU-13 병합 후 공용 상태 문서를 완료로 갱신했다.
- 범위 밖 advisor: Supabase Auth의 leaked password protection 비활성 경고는 기존 프로젝트 설정이다. [공식 설정 안내](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)를 따라 배포 전 별도 결정한다.
- 정보성 advisor: 신규 및 기존 인덱스의 unused 표시는 아직 운영 트래픽이 없어서 발생했다. 삭제하지 않는다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. WU-15에서 WU-11 public summary와 creator evidence를 지도·상세 UI에 실제 연결한다.
2. 배포 전 Vercel Preview/Production에 RATE_LIMIT_NETWORK_SALT가 server-only로 존재하는지 값 없이 확인하고 Preview smoke test를 진행한다.
3. P1 관리자 held 검토·복구를 시작할 때 proof 소비와 append-only audit transition을 다시 검증한다.

## 9. 세션 업데이트

### 2026-08-25

- 추가 구현: WU-11 migration 2개를 대상 Supabase 프로젝트에 적용하고 API guard·환경 계약·테스트를 추가했다.
- 새 문제 또는 막힘: Docker 부재와 WU-13 공용 문서 충돌 가능성을 확인했다.
- 해결 또는 시도: DB 테스트를 원격 rollback transaction으로 대체했고, WU-13 병합 후 공용 문서 상태를 안전하게 갱신했다. advisor FK 경고는 후속 migration으로 해결했다.
- 검증 결과: pgTAP 18/18, Vitest 108/108, lint/typecheck/build 성공.
- 현재 재개 지점: WU-11 완료. WU-15에서 실제 데이터 수직 통합을 시작한다.
