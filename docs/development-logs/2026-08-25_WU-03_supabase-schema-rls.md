# [WU-03] Supabase 반응·방문·크리에이터 schema와 RLS

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-03 |
| 상태 | 완료 |
| 작업일 | 2026-08-25 |
| 담당 | B1 |
| 대상 AC | AC-06~13, AC-26 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-20 |
| 다음 작업 단위 | WU-04 식당·반응·크리에이터 합성 seed |

## 1. 이번 작업의 목표

- 해결하려는 문제: 이전 job-finder 스키마가 남은 Supabase 프로젝트를 Be-Jarvis 전용으로 정리하고, 반응·방문 증명·감사 이벤트·공개 projection·크리에이터 동기화 원본의 보안 경계를 만든다.
- 세션 범위: 레거시 앱 테이블 초기화, 9개 application table, 제약조건·인덱스, RLS·명시적 GRANT, 원격 migration, DB 테스트, advisor, TypeScript 타입 생성.
- 완료 조건: 비로그인·본인·다른 사용자·service role 및 실패 경로가 재현 가능하게 통과하고 원본 위치·비밀값을 저장하지 않는다.
- 범위 밖 항목: 합성 seed(WU-04), 집계·moderation 함수(WU-05), Auth 반응 API(WU-09), 위치 거리 검증(WU-10), Auth 대시보드의 유출 비밀번호 보호 설정.

## 2. 무엇을 만들었는가

- 원격 `Be-jarvis` 프로젝트에서 레거시 `jobs` 151건과 `scraps` 3건만 migration으로 삭제했다. Supabase 관리 영역의 Auth 사용자 1명과 빈 Storage는 보존했다.
- `restaurants`, `visit_proofs`, `restaurant_reactions`, `reaction_events`, `restaurant_reaction_summaries`, `creator_channels`, `creator_videos`, `creator_visit_evidence`, `youtube_sync_runs`를 생성했다.
- 세 반응·moderation·방문 방식·크리에이터 상태 check, 사용자·식당 unique, 방문 증명 소유권 복합 FK, counted 반응의 방문 증명 필수 조건을 추가했다.
- 모든 application table에 RLS를 켰다. 공개 식당·summary, 사용자 소유 방문 증명·반응, server-only 운영 테이블을 명시적 GRANT와 정책으로 분리했다.
- `reaction_events`는 service role도 update/delete할 수 없는 append-only 테이블로 만들었다.
- 원본 위도·경도·GPS 응답·영수증 이미지·YouTube 전체 응답을 저장하는 필드를 만들지 않았다.
- Supabase CLI 2.115.0, 로컬 설정, migration 이력, pgTAP 테스트, 원격 생성 TypeScript 타입을 저장소에 추가했다.

변경한 파일:

- `supabase/config.toml`
- `supabase/migrations/*.sql`
- `supabase/tests/wu_03_schema_rls_test.sql`
- `supabase/seed.sql`
- `src/lib/supabase/database.types.ts`
- `package.json`, `pnpm-lock.yaml`
- `README.md`
- `docs/DEVELOPMENT_PRIORITY.md`
- `docs/development-logs/INDEX.md`

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: 프로젝트 이름은 Be-Jarvis였지만 원격에는 과거 job-finder 테이블과 migration 이력이 남아 있었다.
- 문제: 비대화형 Windows 환경에서 pnpm과 Supabase CLI가 모듈 정리 확인 및 사용자 설정 디렉터리 권한 때문에 처음 실행되지 않았다.
- 문제: 최초 DB 테스트는 고정 identity ID와 이미 사용된 proof를 가정해 의도한 FK·append-only 실패가 아닌 다른 결과를 냈다.
- 문제: performance advisor가 복합 방문 증명 FK의 covering index 누락을 발견했다.
- 영향: 정확한 초기화 범위, migration 이력 정렬, 권한 실패 경로를 확인하기 전에는 완료로 판단할 수 없었다.

## 4. 어떻게 해결했는가

- 원인: 프로젝트 이름 변경은 기존 DB 내용을 지우지 않으며, CLI 중단 시 package/lockfile과 설치 디렉터리가 부분적으로 어긋날 수 있었다.
- 선택한 해결 방법: 대상 project ref를 다시 조회하고 `public.jobs`·`public.scraps`만 삭제하는 별도 migration을 적용했다. 원격의 이전 migration 버전은 로컬 역사 마커로 보존해 이후 이력 충돌을 피했다.
- 선택한 해결 방법: Supabase CLI를 정확히 2.115.0으로 고정하고 `CI=true`·공식 `migration new`·`test new` 흐름을 사용했다.
- 선택한 해결 방법: 테스트에 미사용 합성 proof를 추가하고 감사 이벤트를 고정 identity가 아닌 `reaction_id`로 찾도록 수정했다.
- 선택한 해결 방법: advisor 후속 migration에 복합 FK index와 server-only 명시적 false 정책을 추가한 뒤 테스트와 advisor를 다시 실행했다.
- 다른 선택지를 쓰지 않은 이유: 프로젝트 전체 reset이나 Auth 삭제는 사용자 계정·Supabase 관리 데이터를 불필요하게 파괴하고, Dashboard 즉석 DDL은 저장소 migration을 단일 진실원본으로 유지할 수 없다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 원격 DB 단위 테스트 | `supabase/tests/wu_03_schema_rls_test.sql`을 원격 트랜잭션에서 실행 | 성공 | pgTAP 36/36, 마지막 `ROLLBACK` |
| RLS·GRANT 실패 경로 | anon·authenticated 2명·service role fixture | 성공 | 활성 공개 1건, 각 사용자 소유 행만 1/2건, 직접 insert/update 차단 |
| 무결성 실패 경로 | invalid kind·중복 반응·proof 소유권·event update/delete | 성공 | check·unique·FK·SQLSTATE 55000 확인 |
| Supabase advisor | security·performance advisor 재실행 | 성공 | 누락 RLS/정책·미인덱스 FK 0건 |
| 환경 계약 | `pnpm run check:env` | 성공 | 7개 키 선언 확인 |
| 정적 검사 | `pnpm run lint`, `pnpm run typecheck` | 성공 | 오류 0건 |
| 앱 단위 테스트 | `pnpm test` | 성공 | 2 files, 16 tests |
| 빌드 | `pnpm run build` | 성공 | Next.js 16.3.2 production build |
| 원격 상태 복구 | 테스트 후 row·extension 확인 | 성공 | 앱 핵심 테이블 0건, Auth 1명 유지, pgTAP 미잔존 |

- 통과한 AC: WU-03 범위의 AC-06~10 기반 권한·소유권·unique·감사 계약, AC-11 기반 projection 분리, AC-13 기반 proof 재사용 제약, AC-26.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: `pnpm run test:db` 로컬 컨테이너 실행은 Docker가 설치되지 않아 미실행했다. 동일 SQL을 원격 트랜잭션에서 실행해 36/36 통과 후 롤백했다. 위치 거리·정확도·24시간 판정은 WU-10, counted 집계 갱신과 실패 복구는 WU-05 범위다.
- 테스트 데이터 안전 확인: 고정 UUID와 `synthetic-*` 값만 사용했고 전부 롤백했다.
- 비밀값 노출 확인: 없음. publishable/secret/service-role key와 연결 문자열을 조회·기록·커밋하지 않았다.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `supabase/migrations/20260825050049_reset_legacy_job_finder_schema.sql` | 레거시 앱 테이블만 제거 |
| `supabase/migrations/20260825050543_wu_03_reaction_schema.sql` | 핵심 9개 테이블·제약·인덱스·RLS·GRANT 구현 |
| `supabase/migrations/20260825051424_wu_03_advisor_fixes.sql` | 복합 FK index와 server-only 거부 정책 추가 |
| `supabase/tests/wu_03_schema_rls_test.sql` | 구조·권한·소유권·실패 경로 36개 검증 |
| `src/lib/supabase/database.types.ts` | 원격 schema 기반 TypeScript 타입 |
| `package.json`, `pnpm-lock.yaml` | Supabase CLI 2.115.0과 `test:db` 명령 |
| `README.md`, `docs/DEVELOPMENT_PRIORITY.md`, `docs/development-logs/INDEX.md` | 완료 상태와 다음 WU 동기화 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: Auth의 leaked password protection이 꺼져 있다는 security advisor 경고가 1건 남아 있다. 공개 출시 전 Supabase Auth 설정에서 활성화하고 로그인 회귀 테스트가 필요하다.
- 남은 위험: performance advisor의 unused index는 데이터가 0건인 초기 schema에서 발생한 정보성 알림이다. 합성 seed와 실제 쿼리 적용 후 사용 통계를 다시 확인한다.
- 후속 작업 후보: WU-04 합성 seed 이후 WU-05 집계·moderation 엔진에서 summary의 원자적 갱신과 마지막 정상 projection 보존을 구현한다.
- 사용자 또는 외부 입력이 필요한 사항: WU-12 전 실제 creator allowlist와 YouTube API key, WU-18 전 Vercel 환경별 값이 필요하다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. 이 일지와 세 migration을 먼저 읽고 WU-04만 활성화한다.
2. `supabase/seed.sql`에 식당 30곳, 반응 0·부족·충분, 모든 moderation 상태, creator candidate·confirmed·stale·hidden 상태를 명시적 합성 데이터로 만든다.
3. subscriber count를 파생 점수로 변환하지 않고 hidden은 null, stale은 공개 제외가 가능한 fixture로 만든다.
4. seed를 두 번 실행해도 중복·결과 변동이 없고, 공개 summary와 confirmed evidence 기대값을 SQL로 검증한다.
5. 원격 적용 전 테스트 fixture가 실제 사용자·실제 위치·실제 YouTube 메타데이터를 포함하지 않는지 정적 검사한다.

## 9. 세션 업데이트

### 2026-08-25

- 추가 구현: Be-Jarvis 원격 프로젝트 초기화, WU-03 schema·RLS·GRANT·테스트·타입 생성.
- 새 문제 또는 막힘: CLI 비대화형 설치, 초기 테스트 fixture 가정, advisor 복합 FK index.
- 해결 또는 시도: 고정 CLI·migration 이력 정렬·fixture 수정·advisor 후속 migration.
- 검증 결과: 원격 DB 36/36, 앱 16/16, lint·typecheck·build 성공.
- 현재 재개 지점: WU-04 합성 seed 설계.
