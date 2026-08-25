# [WU-14] YouTube Cron·인증·동시 실행 방지

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-14 |
| 상태 | 완료 |
| 작업일 | 2026-08-25 |
| 담당 | B2 |
| 대상 AC | AC-14, AC-18 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-12 |
| 다음 작업 단위 | WU-13 — WU-08 완료 뒤 시작 |

## 1. 이번 작업의 목표

- 해결하려는 문제: YouTube 증분 동기화를 Production에서 매일 안전하게 실행하고, 외부 호출·동시 호출·중단된 실행이 중복 데이터나 영구 정지를 만들지 않게 한다.
- 세션 범위: Vercel Cron 일정, `CRON_SECRET` 인증 route, Supabase 원자적 실행 잠금, 15분 만료 복구, 실패 시 안전한 응답, 단위·실제 DB 검증.
- 완료 조건: `0 18 * * *` 일정, 인증 실패·성공, 동시에 한 실행만 허용, 중단된 실행 자동 만료, 실제 WU-12 동기화 회귀, 전체 품질 게이트 통과.
- 범위 밖 항목: WU-13 관리자 UI, WU-18 Vercel Preview·Production 실제 배포와 환경변수 등록.

## 2. 무엇을 만들었는가

- `GET /api/cron/youtube-sync` route를 추가하고 `Authorization: Bearer <CRON_SECRET>`가 정확히 일치할 때만 동기화를 시작하게 했다.
- 비밀값 누락은 503, 인증 실패는 401, 이미 실행 중이면 안전한 무시를 뜻하는 202, 외부 장애는 상세 원인을 숨긴 503으로 응답한다.
- 모든 응답을 `no-store`로 처리해 운영 결과가 캐시에 남지 않게 했다.
- `youtube_sync_runs`에서 `running` 상태가 한 개만 존재하도록 부분 unique index를 추가했다.
- 서버 전용 DB 함수가 15분을 넘긴 `running` 기록을 `failed / expired_running_lock`으로 보존한 뒤 새 실행권을 원자적으로 획득하게 했다.
- 해당 함수는 `service_role`만 실행 가능하며 `anon`, `authenticated`는 실행할 수 없게 했다.
- Vercel Production Cron을 매일 UTC 18:00, 한국 시각 03:00에 실행하도록 설정했다.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: 로컬 `node_modules`에 Supabase CLI 실행 파일이 없어 migration 생성 명령을 바로 쓸 수 없었다.
- 추가 문제: 앱 연결 도구의 개인 프로젝트 목록에는 초대받은 팀 프로젝트가 보이지 않았고, 제한된 로컬 네트워크에서는 첫 live test가 통신 전에 실패했다.
- 추가 문제: SQL 검사 도구 계정은 server-only 함수 실행 권한과 `service_role` 전환 권한이 없어 트랜잭션 검사에 사용할 수 없었다.
- 영향: 임의의 새 프로젝트나 Dashboard 전용 DDL을 만들지 않고, 정확한 팀 프로젝트 확인 뒤 공식 migration 적용 도구와 실제 서버 키 통합 테스트로 검증 경로를 바꿨다.

## 4. 어떻게 해결했는가

- 원격 `origin/main`의 최신 WU-17 변경 파일을 먼저 확인해 Cron route, migration, `vercel.json`과 겹치지 않음을 확인했다.
- migration 파일을 저장소의 단일 진실원본으로 만들고 팀 Production 프로젝트에 같은 SQL을 적용했다.
- 원격 적용 기록의 버전과 로컬 migration 파일명을 일치시켜 이후 `db push`에서 같은 migration이 다시 적용되는 drift를 막았다.
- 브라우저 로그인 상태로 조직·프로젝트명·리전을 확인한 뒤, 실제 DDL 적용은 Supabase의 migration 전용 연결 도구로 실행했다.
- DB 함수는 앱 프로세스 메모리가 아니라 unique index와 하나의 트랜잭션을 사용해 여러 serverless 인스턴스에서도 같은 실행권을 공유하게 했다.
- SQL 검사 도구 권한 제약은 실제 앱 서버와 같은 server secret을 쓰는 통합 테스트로 대체했다. 공개 키 차단, 두 번째 실행 거절, 만료 복구, 실행 완료까지 한 흐름에서 검증했다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| Cron route 단위 테스트 | `npm test -- --run tests/youtube-cron.test.ts tests/supabase-youtube-repository.test.ts` | 성공 | 11개 통과: 설정 누락, 401, 성공, 202, 안전한 503, RPC 저장 경계 |
| 전체 단위 테스트 | `npm test` | 성공 | 8개 파일 49개 통과, live 전용 2개 기본 skip |
| 정적 검사 | `npm run lint`, `npm run typecheck` | 성공 | 오류·경고 0개 |
| 빌드 | `npm run build` | 성공 | Next.js 16.3.2 production build, Cron route가 동적 route로 생성됨 |
| 실제 DB 잠금 | `RUN_YOUTUBE_CRON_INTEGRATION=1` live test | 성공 | 공개 키 401/403, 두 번째 실행 차단, 15분 만료 복구, 실패 기록 보존, 새 실행 정상 종료 |
| WU-12 회귀 | `RUN_YOUTUBE_INTEGRATION=1` live test | 성공 | 새 DB 잠금 경로를 거쳐 5개 채널 증분 동기화 성공 |
| migration 상태 | Supabase migration 목록 재조회 | 성공 | 원격 적용 버전과 로컬 파일명 일치 |
| Supabase advisor | security·performance advisor | 성공 | 이번 변경의 신규 경고 없음 |

- 통과한 AC: AC-14의 동시 실행 격리·중단 실행 복구, AC-18의 예약 동기화 운영 경로.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 없음. Vercel 실제 예약 호출 검증은 아직 배포되지 않은 WU-18의 별도 범위다.
- 테스트 데이터 안전 확인: 실제 잠금 시험은 생성한 실행 기록만 `failed` 또는 `succeeded`로 종료했고 식당·반응·영상 원본을 변경하지 않았다.
- 비밀값 노출 확인: 없음. 환경변수 값, 프로젝트 내부 식별값, API 원본 응답을 Git·일지·테스트 출력에 기록하지 않았다.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `vercel.json` | 매일 03:00 KST Production Cron 일정 |
| `src/app/api/cron/youtube-sync/route.ts` | Next.js Cron GET route |
| `src/server/youtube/youtube-cron.ts` | secret 인증과 안전한 HTTP 응답 |
| `src/server/youtube/supabase-youtube-repository.ts` | DB 원자적 잠금 RPC 사용과 `already_running` 분류 |
| `src/server/youtube/run-youtube-sync.ts` | 인증·잠금 책임 설명 갱신 |
| `supabase/migrations/20260825075925_wu_14_youtube_sync_lock.sql` | 단일 running index·15분 만료·server-only 함수 |
| `tests/youtube-cron.test.ts` | 인증·성공·동시 실행·오류 비노출 테스트 |
| `tests/youtube-cron.integration.test.ts` | 실제 Supabase 권한·잠금·만료 복구 테스트 |
| `tests/supabase-youtube-repository.test.ts` | 잠금 RPC 요청·충돌 분류 테스트 |
| `docs/DEVELOPMENT_PRIORITY.md` | WU-14 완료 상태·증거 |
| `docs/development-logs/INDEX.md` | WU-14 일지와 다음 재개 지점 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: Vercel 프로젝트에는 아직 `CRON_SECRET` 등 Production 환경변수를 등록하거나 실제 Cron을 배포하지 않았다. 이는 WU-18의 공통 배포 작업이다.
- 후속 작업 후보: WU-08 완료 뒤 WU-13 후보 확인·sync log 관리자 UI.
- 사용자 또는 외부 입력이 필요한 사항: WU-13 시작 전 A1에게 WU-08 완료와 관리자 화면의 route·컴포넌트 계약을 확인해야 한다.
- 공유 타입 참고: 실제 DB 타입 생성 결과에는 WU-09 함수와 WU-14 함수가 함께 포함된다. B1의 WU-09 작업과 공용 타입 파일 충돌을 피하려고 이번 브랜치에서는 `database.types.ts`를 덮어쓰지 않았다. 통합 시 B1 최신 결과 위에서 한 번 재생성한다.
- Advisor 참고: 기존 Auth 유출 비밀번호 보호 경고 1개와 사용량이 아직 없는 기존 index 알림 5개가 남아 있다. 이번 migration에서 추가된 경고는 없다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. A1의 WU-08 완료와 관리자 상세 화면 계약을 확인한다.
2. 완료됐다면 WU-13에서 candidate를 confirmed/rejected로 바꾸는 관리자 전용 경계와 sync log UI를 구현한다.
3. WU-18 배포 직전에 Production 환경변수 이름의 누락 여부를 확인하고, Preview smoke test 뒤 같은 artifact를 Production으로 승격한다.
4. Production 배포 후 잘못된 secret의 401, 올바른 Vercel Cron의 200/202, Runtime log의 비밀값 비노출을 검증한다.

## 9. 세션 업데이트

### 2026-08-25

- 추가 구현: Production Cron 일정, 인증 route, DB 원자적 lock, 15분 만료 복구, 안전한 실패 응답, 단위·live 테스트.
- 새 문제 또는 막힘: 로컬 Supabase CLI 부재, 팀 프로젝트의 연결 목록 미표시, 제한된 SQL 검사 계정 권한.
- 해결 또는 시도: 로그인된 팀 대상을 확인하고 migration 전용 도구로 적용한 뒤 실제 서버 환경 통합 테스트로 권한·동시 실행·복구를 검증했다.
- 검증 결과: 기본 49개 테스트, live lock 1개, live YouTube 회귀 1개, lint·typecheck·build 통과. 신규 Supabase advisor 경고 없음.
- 현재 재개 지점: WU-14 완료. WU-13은 WU-08 완료를 기다린다.
