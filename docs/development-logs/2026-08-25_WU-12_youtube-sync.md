# [WU-12] YouTube Data API 증분 동기화·stale 처리

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-12 |
| 상태 | 진행 중 |
| 작업일 | 2026-08-25 |
| 담당 | B2 |
| 대상 AC | AC-15~19 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-03, WU-04 |
| 다음 작업 단위 | Supabase 실제 저장 검증 후 WU-13 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 팀이 정한 YouTube 채널의 새 영상과 메타데이터를 공식 API로만 가져오고, 삭제·비공개·30일 만료 상태를 안전하게 처리한다.
- 세션 범위: 5개 채널 allowlist, `channels.list`·uploads playlist·`playlistItems.list`·`videos.list` 어댑터, 증분 동기화, Supabase REST 저장 계층, 자동 장소 후보, 동기화 실행 기록, 테스트.
- 완료 조건: 공식 API 실조회, hidden subscriber 처리, 30일 refresh, 채널별 실패 격리, 삭제 영상 stale 처리, 전체 품질 게이트, 실제 Supabase 저장 1회 검증.
- 범위 밖 항목: WU-13 관리자 인증·후보 확인 UI, WU-14 Cron 인증·동시 실행 lock.

## 2. 무엇을 만들었는가

- 팀이 확정한 5개 채널 ID를 서버 allowlist로 고정했다.
- YouTube Data API v3의 필요한 응답 필드만 안전한 내부 타입으로 바꾸며 원본 응답 전체는 저장하거나 기록하지 않는다.
- 채널의 uploads playlist를 최신순으로 최대 2페이지 조회하고, 이후에는 새 영상과 메타데이터 확인 시각이 30일 이상 지난 영상만 다시 읽는다.
- `hiddenSubscriberCount=true`이면 구독자 수를 `null`로 저장한다.
- 한 채널이 실패해도 나머지 채널을 계속 처리하고 동기화 실행을 `partial`로 기록한다.
- YouTube가 기존 영상을 돌려주지 않으면 영상을 비활성·`deleted`로 바꾼 뒤 연결된 `candidate/confirmed` 근거를 `stale`로 바꾼다.
- 영상 제목·설명과 활성 식당 이름의 정규화된 일치만 `candidate`로 저장한다. 후보는 기존 server-only RLS/GRANT 경계를 그대로 사용하며 관리자 확인 전 공개하지 않는다.
- WU-13 수동 실행과 WU-14 Cron이 재사용할 `runYouTubeSync` 서버 진입점을 만들었다.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: 로컬 `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`가 없다.
- 막힌 지점: 실제 `Be-jarvis` Supabase에 채널·영상·후보·동기화 실행을 한 번 저장하는 end-to-end 검증.
- 영향: 코드, 단위 테스트, 실제 YouTube 조회는 완료했지만 WU-12는 아직 완료 상태로 올리지 않는다.

## 4. 어떻게 해결했는가

- 외부 API와 DB를 의존성 주입 가능한 어댑터로 분리해 비밀값 없이 정상·실패·복구 경로를 자동 검증했다.
- Supabase schema, migration, seed, package와 공통 타입은 수정하지 않고 WU-03의 server-only 테이블과 권한 계약을 그대로 사용했다.
- 실제 YouTube 키로 선택한 5개 채널과 각 uploads playlist의 존재를 확인했다. 키와 원본 API 응답은 출력하지 않았다.
- Supabase 실제 저장은 서버 환경변수를 안전하게 연결한 다음 이어서 검증한다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 전체 단위 테스트 | `vitest run --reporter=verbose` | 성공 | 7개 파일, 42개 테스트 통과 |
| 정적 검사 | `eslint .`, `tsc --noEmit` | 성공 | 오류·경고 0개 |
| 빌드 | `next build` | 성공 | Next.js 16.3.2 production build |
| 실제 YouTube API | 공식 `channels.list` 최소 필드 조회 | 성공 | allowlist 5/5, uploads playlist 5/5 |
| 실패·복구 경로 | 채널별 오류·삭제 영상 mock | 성공 | 다른 채널 지속, 기존 영상 비활성 후 evidence stale |
| 실제 Supabase 저장 | `runYouTubeSync("manual")` | 미실행 | 로컬 Supabase 서버 환경변수 누락 |

- 통과한 AC: AC-16 공식 API 전용, AC-18 hidden·30일 refresh의 코드·테스트 경로, AC-19 candidate 비공개 저장 경계.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 실제 Supabase 저장은 서버 환경변수 연결이 필요하다.
- 테스트 데이터 안전 확인: 자동 테스트는 합성 데이터만 사용했고 실제 확인은 채널 공개 메타데이터의 존재 여부만 사용했다.
- 비밀값 노출 확인: 없음. `.env.local`은 Git 비추적 상태이며 키 값과 원본 응답을 출력하지 않았다.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `src/server/youtube/creator-allowlist.ts` | 확정된 5개 채널 allowlist |
| `src/server/youtube/youtube-data-api.ts` | 공식 YouTube API 서버 어댑터 |
| `src/server/youtube/youtube-sync.ts` | 증분·30일 refresh·partial·stale 동기화 규칙 |
| `src/server/youtube/supabase-youtube-repository.ts` | WU-03 테이블용 server-only REST 저장 계층 |
| `src/server/youtube/run-youtube-sync.ts` | WU-13·14가 재사용할 서버 진입점 |
| `tests/youtube-data-api.test.ts` | API 필드·배치·hidden·오류 테스트 |
| `tests/youtube-sync.test.ts` | 증분·partial·candidate·stale 테스트 |
| `tests/supabase-youtube-repository.test.ts` | 비밀키 경계·upsert·stale 저장 테스트 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 실제 Supabase PostgREST 응답과 upsert 동작을 아직 end-to-end로 확인하지 않았다.
- 후속 작업 후보: WU-13 관리자 인증·후보 확인·sync log UI, WU-14 Cron secret·동시 실행 lock.
- 사용자 또는 외부 입력이 필요한 사항: 올바른 `Be-jarvis` 프로젝트의 URL과 서버 비밀키를 로컬 `.env.local`에 안전하게 연결할 권한.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. Supabase Dashboard의 정확한 `Be-jarvis` 프로젝트인지 다시 확인한 뒤 URL과 secret key를 `.env.local`에만 저장한다.
2. `runYouTubeSync("manual")`을 한 번 실행하고 `youtube_sync_runs`, `creator_channels`, `creator_videos`, `creator_visit_evidence`의 건수·상태만 검증한다.
3. 공개 권한으로 `candidate`가 조회되지 않는지 다시 확인한다.
4. 전체 테스트와 빌드를 재실행한 뒤 WU-12를 완료로 바꾸고 로컬 커밋·push 안전 검사를 수행한다.

## 9. 세션 업데이트

### 2026-08-25

- 추가 구현: allowlist, 공식 API 어댑터, Supabase 저장 계층, 증분 동기화, 자동 후보와 stale 처리.
- 새 문제 또는 막힘: Supabase 서버 환경변수 부재.
- 해결 또는 시도: 실제 YouTube API 5개 채널 확인, Supabase 부분은 mock 저장 테스트로 안전 경로를 먼저 검증.
- 검증 결과: 42/42 테스트, lint, typecheck, build 성공.
- 현재 재개 지점: Supabase 서버 환경변수 연결 권한을 확인하고 실제 저장 1회를 검증한다.
