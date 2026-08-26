# [WU-15] 30곳 실제 수직 통합 — 공개 데이터·API

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-15 |
| 상태 | 막힘 |
| 작업일 | 2026-08-26 |
| 담당 | 데이터·API + UI 통합 |
| 대상 AC | AC-01~24 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-07, WU-11, WU-13 |
| 다음 작업 단위 | UI 기준선 커밋 검토 후 새 YouTube 키·Preview 설정으로 실제 30곳 smoke 재개 |

## 1. 이번 작업의 목표

- 실제 Supabase의 활성 식당 30곳을 공개 지도·목록·상세 화면이 같은 계약으로 읽을 수 있게 한다.
- 공개 집계는 활성 `counted` 반응만 반영하고, `held`, `private_only`, `rejected`, 감사 이벤트, 방문 proof, 원본 GPS를 API 경계 밖에 둔다.
- YouTube 근거는 `confirmed`이면서 최신·공개·활성인 영상과 allowlist 채널만 제공한다.
- DB 장애와 정상 빈 결과를 구분해 화면이 장애를 빈 점수나 허위 0점으로 표현하지 않게 한다.
- 개인 취향은 서버 공개 집계에 합치지 않고 식당의 로컬 매칭 입력만 전달한다.

## 2. A에게 확정한 공개 계약

- 목록: `GET /api/restaurants`
- 상세: `GET /api/restaurants/:id`
- 성공: `{ ok: true, data, meta: { generatedAt, restaurantCount } }`
- DB/설정 실패: HTTP 503, `{ ok: false, error: { code: "PUBLIC_DATA_UNAVAILABLE", message, retryable: true } }`
- 없는 상세와 잘못된 식당 ID: HTTP 404, `RESTAURANT_NOT_FOUND`, `retryable: false`
- 식당 DTO: ID, Kakao place ID, 이름·분류·주소, 지도 좌표, counted-only 반응 요약, 로컬 매칭용 식당 프로필, 공개 creator evidence.
- 영상 근거: YouTube 영상·채널 링크, 영상 시각, 게시·메타데이터·검증 기준 시각, 구독자 원값 또는 `hidden`/`stale`/`unavailable` 상태.
- 공개 계약에 moderation 세부값, 관리자 후보·메모·확정자, 반응 원본, 감사 이벤트, 방문 proof, 사용자 식별자와 GPS는 없다.

## 3. 구현 내용

- 서버 전용 Supabase REST repository가 명시적 컬럼 projection으로 활성 식당·공개 summary·creator evidence를 조회한다.
- repository가 DB 필터 뒤에도 `confirmed`, fresh, public, active, allowlist 조건을 다시 검사해 후보·거절·stale·삭제 데이터가 직렬화되지 않게 했다.
- `counted_total = 0`인 정상 summary만 0건 DTO로 만들고, 식당별 summary 누락이나 조회 실패는 예외로 올려 API가 명시적 503을 반환한다.
- 구독자 수는 반올림·권위 점수 변환 없이 원값을 유지한다. 비공개 또는 오래된 값은 `null`과 상태 이유로 구분한다.
- Next.js Route Handler는 동적·`no-store` 오류 응답이며 테스트를 위해 repository dependency를 주입할 수 있다.
- 이번 작업은 기존 schema·RLS·GRANT로 충족돼 migration과 `database.types.ts` 변경을 추가하지 않았다.

## 4. 테스트와 검증

| 검증 항목 | 결과 | 증거 또는 비고 |
|---|---|---|
| 공개 API·repository 단위 테스트 | 성공 | 비로그인 목록/상세, counted-only, held/private 비노출, confirmed-only, 구독자 known/hidden/stale, 빈 결과, DB 실패·404 |
| 전체 Vitest | 성공 | 22개 파일 성공, 2개 skip, 133개 테스트 성공 |
| lint·typecheck | 성공 | 오류 0 |
| production build | 성공 | Next.js 16.3.2, `/api/restaurants`와 `/api/restaurants/[id]` 동적 route 생성 |
| 실제 Be-jarvis DB pgTAP | 성공 | 12/12, 활성 식당 30곳·summary 30행·anon 컬럼 GRANT/RLS·민감 테이블 차단·counted-only·영상 자격 검증 후 rollback |
| Supabase advisor | 성공 | Security DB 오류 0, Performance 오류·경고 0 |
| 로컬 DB 테스트 | 환경상 대체 | Docker/local stack 부재로 127.0.0.1:54322 연결 실패; 동일 SQL을 대상 DB rollback transaction으로 검증 |

- Security Advisor의 기존 Auth `Leaked Password Protection Disabled` 경고 1건은 이번 변경과 무관하며 새 DB 경고는 없다.
- 테스트는 원격 데이터를 변경하지 않았고 transaction을 즉시 rollback했다.
- 비밀값, 원본 GPS, proof, 사용자·관리자 식별정보를 출력하거나 저장하지 않았다.

## 5. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `src/contracts/public-restaurants.ts` | A와 공유하는 공개 목록·상세·오류 DTO |
| `src/server/restaurants/public-restaurant-repository.ts` | 실제 Supabase 조회와 공개 경계 필터 |
| `src/server/restaurants/public-restaurants-api.ts` | 목록·상세 성공/오류 HTTP 계약 |
| `src/server/restaurants/configured-public-restaurants.ts` | 서버 설정 repository 조립 |
| `src/app/api/restaurants/route.ts` | 공개 목록 route |
| `src/app/api/restaurants/[id]/route.ts` | 공개 상세 route |
| `tests/public-restaurants-api.test.ts` | DTO·필터·빈 결과·DB 실패 회귀 |
| `supabase/tests/wu_15_public_data_test.sql` | 실제 DB의 anon·RLS·GRANT·집계·영상 경계 pgTAP |
| `docs/DEVELOPMENT_PRIORITY.md` | WU-15를 진행 중으로 표시 |
| `docs/development-logs/INDEX.md` | 현재 일지와 UI 통합 재개 지점 연결 |

## 6. 남은 위험과 재개 지점

- WU-15 전체 완료 조건은 A의 지도·목록·상세 연결, 브라우저 수동 검증, 공통 회귀와 두 브랜치 통합이다. 따라서 이번 데이터·API 작업만으로 WU-15를 `완료`로 바꾸지 않는다.
- A의 최신 원격 `codex/kakao-map-update`는 `main`과 merge-base가 없고 저장소가 `Be-Jarvis-main/` 하위에 중첩된 별도 루트다. 현재 파일 경로의 직접 중복은 없지만 그대로 merge할 수 없으므로, A 변경을 최신 `main` 기반 정상 브랜치로 옮긴 뒤 통합해야 한다.
- A는 성공 응답만 렌더링하고 503에서는 빈 배열·0점으로 대체하지 않아야 한다. `PUBLIC_DATA_UNAVAILABLE` 오류 상태를 명시적으로 보여야 한다.
- 개인 취향 선택·하드 제외는 기존 로컬 P0 계약을 계속 사용하고 `reactionSummary`에 합산하지 않는다.
- 통합 직전 A의 활성 브랜치와 공용 문서 충돌을 다시 확인하고, 완료 게이트가 모두 통과한 뒤에만 INDEX와 개발 우선순위를 `완료`로 갱신한다.

## 7. 세션 업데이트

### 2026-08-26 — 데이터·API 담당

- 추가 구현: 실제 30곳 목록·상세 DTO, counted-only summary, 공개 creator evidence, 명시적 503/404 계약, 단위·원격 DB 테스트.
- 새 문제 또는 막힘: 연결된 Supabase 도구에는 팀 프로젝트가 보이지 않았고 로컬 Docker가 없었다.
- 해결 또는 시도: 로그인된 Supabase Dashboard에서 정확한 Be-jarvis 프로젝트를 확인하고, SQL Editor의 `BEGIN ... ROLLBACK`으로 pgTAP 12개를 실행했다.
- 검증 결과: pgTAP 12/12, Vitest 133개, lint·typecheck·build, security/performance advisor 통과.
- push 안전 확인: `git fetch --prune origin`은 성공했다. `pnpm run check:push-safety`는 A 브랜치의 merge-base 부재에서 중단됐고 열린 PR은 0개였다. 커밋은 보존하되 원격 push는 하지 않았다.
- 현재 재개 지점: A 브랜치를 최신 `main` 기반으로 정상화한 뒤 push 안전 검사를 다시 통과시키고, 화면 연결과 WU-15 전체 통합 회귀를 진행한다. 전체 완료 전까지 상태는 `진행 중`이다.

### 2026-08-26 — 통합 빌드 게이트 복구

- 추가 구현: 지도·목록·상세가 fixture 대신 공개 DTO를 서버에서 읽도록 연결하고, 관리자 YouTube 동기화·후보 route의 서버 설정 검증을 모듈 로딩이 아닌 실제 요청 시점으로 지연했다.
- 문제와 막힌 지점: 로컬에서 `pnpm run build`가 관리자 route를 수집하는 중 `SUPABASE_SECRET_KEY` 누락으로 중단됐다. 공개 화면 검증만 하려 해도 WU-13 관리자 저장소가 eager하게 생성되는 문제였다.
- 해결: `createConfiguredCreatorAdminDependencies`의 auth·repository를 요청 시 생성하는 adapter로 바꾸고, 관리자 로그인 route도 로그인 요청 시 auth를 조립하게 했다. 설정이 없으면 기존 안전한 503 경로를 유지한다.
- 검증 결과: 전체 Vitest 25개 파일 137개 성공·2개 skip, lint·typecheck 성공, Next.js 16.3.2 production build 성공. 로컬 공개 지도는 Supabase 서버 설정이 없는 경우 임의 0건/fixture 대신 명시적 데이터 연결 불가 화면을 표시하는 것을 수동 확인했다.
- 변경 파일: `src/server/admin/configured-creator-admin.ts`, `src/app/api/admin/session/route.ts`, `tests/configured-creator-admin.test.ts`, 공개 DTO UI adapter·지도·상세 연결 파일.
- 남은 위험과 미해결 항목: 로컬에 실제 Supabase server key가 없어 실제 30곳 성공 화면은 아직 Preview 또는 설정된 개발 환경에서 확인해야 한다. YouTube API key는 수동 sync·Cron을 실제 실행할 배포 환경의 server-only 변수로만 필요하다.
- 다음 작업에서는 어떻게 해야 하는가: Preview에서 실제 공개 목록·상세·영상 근거·반응 API의 성공 경로를 smoke test하고, 개인 취향 local storage와 matching UI가 공개 집계와 분리되는지 회귀 확인한다.

### 2026-08-26 — Vercel Preview 환경 연결 보안 중단

- 추가 작업: `acme/be-jarvis` Vercel 프로젝트와 GitHub 저장소 연결을 확인했고, Preview 전용 범위에 `SUPABASE_SECRET_KEY`를 Secret으로 등록했다. Production 범위에는 이 값을 등록하지 않았다.
- 문제와 막힌 지점: YouTube API 키를 Vercel 입력 폼에 넣은 뒤 브라우저 자동화의 폼 상태 출력이 값을 마스킹하지 않는 문제가 발생했다. 저장 버튼은 누르지 않았고 입력 폼을 닫아 Vercel에는 해당 YouTube 키를 등록하지 않았다.
- 해결 또는 안전 조치: 노출 가능성이 있는 YouTube 키는 즉시 폐기·교체가 필요한 것으로 처리했다. 원래 키를 다시 사용하거나 기록하지 않으며, 새 키가 준비되기 전에는 `YOUTUBE_DATA_API_KEY` 등록·YouTube sync·Cron 검증을 재개하지 않는다.
- 검증 결과: Vercel 프로젝트가 `hyeok18/Be-Jarvis` 저장소에 연결됐고 Production·Preview 배포가 아직 없음을 Dashboard에서 확인했다. Preview-only 선택 상태로 Supabase server secret 1개가 등록된 것을 이름과 범위만으로 확인했다. 이 세션에서는 새 Preview 배포, smoke test, YouTube sync를 실행하지 않았다.
- 변경 파일: Vercel 외부 설정(Preview Secret 1개)과 이 개발일지·인덱스만 변경했다. 키 값, 원본 GPS, 사용자 정보는 기록하지 않았다.
- 남은 위험과 미해결 항목: 새 YouTube Data API 키의 발급·제한 설정과 `youtube.env` 교체가 필요하다. Preview 공개 성공 화면에는 추가로 공개 Supabase 설정·Kakao 공개 앱 키를 Config로 등록해야 하며, 공개 server secret은 Preview 범위만 유지해야 한다.
- 다음 작업에서는 어떻게 해야 하는가: 사용자가 Google Cloud Console에서 기존 YouTube 키를 삭제 또는 제한 해제 대신 **폐기 후 새 키 발급**하고 로컬 `youtube.env`를 새 값으로 교체한 뒤, 먼저 새 키가 노출되지 않는 등록 경로를 선택한다. 그 다음 Preview의 공개 Config 3개를 등록하고 feature branch Preview에서 smoke test를 실행한다.

### 2026-08-26 — UI 기준선 선택 이식과 WU-15 연결 계약 보존

- 추가 구현: 최신 `origin/main`을 조상으로 포함하고 WU-15 공개 DTO 연결 커밋을 보존한 `codex/ui-baseline` 작업 브랜치에서 홈·지도·선택 시트·식당 상세의 반응형 UI 기준선을 정리했다. `origin/codex/kakao-map-update`의 독립 이력은 merge·cherry-pick·전체 복사하지 않고, 레이아웃과 시각 언어만 수동으로 참고했다.
- 데이터 연결 계약: 홈은 Server Component에서 `PublicRestaurantRepository.list()` 결과를 `toMapExplorerData()`로 변환해 `MapExplorerData`를 전달한다. 지도 UI는 `selectedRestaurantId: string | null`, `selectedCategory`, `mode`만 소유하며, 선택 시트는 `Restaurant`, counted-only `RestaurantReactionSummary`, 별도 `RestaurantMatchResult`, confirmed-only `CreatorVisitSource[]`를 받는다. 상세는 실제 route `id`와 `toRestaurantDetailData()`를 유지해 `ReactionSelector`, `ReactionDistribution`, `CreatorEvidenceList`, `DetailMatchPanel`에 연결한다. 503은 `PublicDataUnavailable`로 표시하고 빈 0건으로 바꾸지 않는다.
- 범위 제외: 엑셀 100명 응답·엑셀 반응 수·테스트 식당명·mock 앱·먹BTI·저장·내 정보·임시 하단 라우팅·Kakao SDK/API 재구현·새 위치 버튼을 추가하지 않았다. 디자인 브랜치의 CSS와 폴더를 통째로 복사하지 않았고 CSS Module로 다시 구성했다. 사용 권한이 확인되지 않은 이미지·마커 자산은 이식하지 않았다.
- 기능 보존: 인증, 반응 생성·변경, 체크인 검증, YouTube 동기화, API·server·contract·migration·package·lockfile은 이 세션에서 수정하지 않았다. 카테고리는 활성 항목을 다시 누르면 `전체`로 돌아가며, 전체 상태에서 결과 없음 안내를 만들지 않는다. 공개 반응과 개인 매칭을 결합하거나 별점·평균점수·종합점수·신뢰도 점수를 추가하지 않았다.
- 검증 결과: ESLint 성공, TypeScript 성공, Vitest 26개 파일 성공·2개 skip 및 143개 테스트 성공·2개 skip, Next.js 16.3.2 `next build --webpack` 성공. 격리 worktree의 의존성 junction 때문에 기본 Turbopack build는 저장소 루트 밖 symlink를 거부했으나 같은 코드의 Webpack production build는 성공했다. 390×844와 1440×900에서 홈·상세를 브라우저로 확인했고 가로 넘침·Next 오류 오버레이·console error가 없었다. 카테고리 재클릭 해제, 식당 선택 시트, 세 반응 `aria-pressed`, 44px 이상 터치 영역을 확인했다. 수동 검증용 합성 route는 검증 뒤 삭제해 최종 변경에 포함하지 않았다.
- 변경 파일: `src/app/page.tsx`, `src/app/page.module.css`, `src/app/restaurants/[id]/page.tsx`, `src/app/restaurants/[id]/page.module.css`, `src/components/map/category-filter.tsx`, `src/components/map/map-explorer.tsx`, `src/components/map/map-explorer.module.css`, `src/components/map/map-view-model.ts`, `src/components/map/selected-restaurant-sheet.tsx`, `src/components/map/selected-restaurant-sheet.module.css`, `tests/map-explorer-view-model.test.tsx`, 이 일지와 `INDEX.md`.
- 새 문제 또는 막힘: UI 로컬 구현과 합성 데이터 브라우저 검증은 끝났지만, 폐기 대상 YouTube 키를 교체하지 않아 실제 Preview 배포·30곳 성공 경로 smoke test는 계속 중단한다. `codex/ui-baseline`은 WU-15 선행 로컬 커밋 3개 위에서 생성됐으므로 PR diff에는 공개 API/UI adapter/보안 중단 기록과 이번 UI 변경이 함께 보인다.
- push 안전 확인: 커밋 뒤 `git fetch --prune origin`은 성공했다. `check:push-safety`는 `origin/codex/kakao-map-update`와 `origin/main` 사이에 merge-base가 없어 diff 계산 단계에서 실패했다. 이를 건너뛴 수동 대조에서는 미병합 `origin/codex/mobile-map-prototype`과 `src/app/page.tsx`, `src/app/restaurants/[id]/page.tsx`가 겹쳤다. 팀의 활성 여부와 통합 담당이 정해지기 전에는 push·PR을 만들지 않는다.
- React 검토: 서버 데이터 패칭은 Server Component에 유지했고 새 클라이언트 fetch나 waterfall을 만들지 않았다. 상태는 기존 `MapExplorer`·`ReactionSelector` 경계에만 두었으며, 전역 CSS 대신 scoped CSS Module을 사용해 공용 스타일 충돌을 줄였다.
- 현재 재개 지점: 먼저 이 UI 기준선 커밋과 포함된 WU-15 선행 커밋 3개의 통합 범위를 리뷰한다. 그 다음 기존 YouTube 키를 폐기하고 새 키·Preview Config를 안전하게 등록해 실제 공개 목록·상세·반응·confirmed 영상 근거를 smoke test한다. 이 조건 전에는 WU-15를 완료로 바꾸지 않는다.

### 2026-08-26 — 다른 작업 기록 대조와 push 안전 재확인

- 추가 확인: Codex 작업 `GitHub 연동 후 pull`과 `main 브랜치에 파일 반영` 기록을 읽어, 과거 메인 작업이 WU-03·04·05·07·09를 원격 `main`에 통합한 과정임을 확인했다. 현재 `codex/ui-baseline`은 그 뒤의 `origin/main` `5ea3edc`를 조상으로 두고 WU-15 공개 데이터/API·보안 중단 기록·UI 기준선 커밋을 포함한다.
- push 안전 확인: `git fetch --prune origin`은 프로세스 한정 `safe.directory` 설정으로 성공했다. `pnpm run check:push-safety`는 격리 worktree의 `node_modules` purge 확인이 non-TTY에서 중단되어 스크립트 본문까지 가지 못했다. 같은 스크립트를 Node로 직접 실행한 결과, sandbox에서는 네트워크 제한으로 실패했고 네트워크 권한과 프로세스 한정 `safe.directory`를 적용한 실행에서는 `origin/codex/kakao-map-update`와 `origin/main` 사이에 merge-base가 없어 실패했다.
- 수동 대조: `git branch -r --no-merged origin/main` 기준 미병합 원격은 `origin/codex/kakao-map-update`, `origin/codex/mobile-map-prototype` 두 개다. `origin/codex/kakao-map-update`는 공통 이력이 없어 비교·merge 대상이 아니며, `origin/codex/mobile-map-prototype`는 `src/app/page.tsx`, `src/app/restaurants/[id]/page.tsx`가 `codex/ui-baseline`과 겹친다.
- 변경 파일: 이 개발일지와 `docs/development-logs/INDEX.md`만 갱신한다. 코드, API, migration, package, lockfile, 비밀값은 수정하지 않았다.
- 남은 위험과 미해결 항목: 팀에서 `codex/mobile-map-prototype`와 `codex/kakao-map-update`의 활성 여부 또는 통합 담당을 확정하기 전에는 `codex/ui-baseline`을 push·PR로 올리지 않는다. 기존에 노출 가능성이 생긴 YouTube 키도 폐기·재발급 전까지 Preview smoke와 YouTube sync를 재개하지 않는다.
- 다음 작업에서는 어떻게 해야 하는가: 먼저 팀에 `codex/mobile-map-prototype`의 홈/상세 변경을 폐기할지, UI 기준선에 흡수할지, 별도 통합 담당이 처리할지 결정하도록 공유한다. 동시에 사용자가 Google Cloud Console에서 기존 YouTube 키를 폐기하고 새 서버 전용 키를 준비하면 Preview Config 등록과 실제 30곳 smoke test를 재개한다.

### 2026-08-26 — Preview 재배포 및 실제 데이터 연결 재검증

- 추가 작업: `acme/be-jarvis`의 `codex/ui-baseline` Preview에 새 `YOUTUBE_DATA_API_KEY`를 Preview 전용 Secret으로 교체 등록했다. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`는 Preview 전용 Config로 등록했고, Production 범위는 선택하지 않았다. 같은 커밋 `6dadd3b`을 Preview 환경으로 재배포해 Ready 상태와 배포 URL을 확인했다.
- 새 문제 또는 막힘: 재배포된 실제 홈은 안전한 `공개 데이터 연결` 오류 화면을 표시했다. 로컬 `youtube.env`의 `NEXT_PUBLIC_SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 서버 repository와 같은 REST 요청 방식으로 읽기 전용 검증한 결과 HTTP 401이었고, Bearer 인증을 추가한 검증도 HTTP 401이었다. 따라서 현재 Supabase 서버 키는 대상 프로젝트에서 인증되지 않으며, YouTube 키나 UI 코드의 문제가 아니다.
- 해결 또는 시도: 키의 존재·형식과 URL 형식만 비노출 방식으로 확인했고, 비밀값·응답 본문·헤더는 출력하거나 기록하지 않았다. 인증 실패를 0건 데이터나 스냅샷으로 숨기지 않고 기존 `PUBLIC_DATA_UNAVAILABLE` 화면을 유지했다. `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`, `KAKAO_REST_API_KEY`, `RATE_LIMIT_NETWORK_SALT`는 현재 Preview에 없어 각각 지도 fallback 및 반응·체크인 smoke 보류 상태다.
- 검증 결과: Preview 배포 Ready(34초), 실제 홈의 명시적 장애 화면, Supabase REST 활성 식당 read-only HTTP 401을 확인했다. 기존 로컬 품질 게이트 결과는 유지되며, 이번 세션은 외부 환경 설정만 변경해 lint/typecheck/test/build를 재실행하지 않았다.
- 변경 파일: Vercel Preview 환경변수 범위(외부 설정)와 이 개발일지·인덱스·우선순위 문서만 변경했다. Production 환경변수, Supabase schema/data, application code, package/lockfile은 수정하지 않았다.
- 현재 재개 지점: Supabase Dashboard에서 **이 Preview가 읽어야 하는 같은 프로젝트의 새 server secret key**를 다시 발급·검증해 `youtube.env`의 `SUPABASE_SECRET_KEY`를 교체한다. 그 값을 Preview Secret에 갱신하고 재배포한 뒤, 실제 목록 30곳 → 실제 UUID 상세 → confirmed evidence → 반응/check-in 실패·복구 경로 순으로 smoke test한다. 유효한 키를 채팅·Git·개발일지에 붙여넣지 않는다.

### 2026-08-26 — 교체 후 server secret 재검증

- 추가 확인: 사용자가 `youtube.env`의 server secret 교체 완료를 알린 뒤 같은 읽기 전용 REST 검증을 다시 실행했다.
- 검증 결과: HTTP 401이 계속 발생했다. Vercel에 값을 전송하거나 기존 Preview Secret을 변경하지 않았으므로 Production·Preview의 배포 설정에는 추가 변경이 없다.
- 현재 재개 지점: `NEXT_PUBLIC_SUPABASE_URL`의 project ref와 Supabase Dashboard에서 선택한 프로젝트가 같은지 먼저 대조한다. 그 정확한 프로젝트의 **Settings → API Keys → Secret keys**에서 새 `sb_secret_...` 키를 만든 뒤 로컬 파일의 해당 변수만 교체하고 재검증한다.

### 2026-08-26 — 실제 Preview 공개 데이터 smoke 성공

- 진단 정정: 앞선 HTTP 401은 PowerShell 요청의 User-Agent가 Supabase Secret key의 브라우저 차단 조건에 걸릴 수 있는 검사 방식이었다. 실제 Vercel 서버와 같은 Node `fetch`로 `apikey` 헤더만 사용해 재검증한 결과, 활성 식당 read-only 조회는 HTTP 200·JSON 배열·30행이었다. URL·새 server secret 조합은 정상이다.
- 외부 설정: 사용자 승인 후 Vercel `acme/be-jarvis`의 기존 `SUPABASE_SECRET_KEY`를 새 값으로 **Preview 전용 Secret**으로 갱신했다. Vercel이 `Updated`와 Preview 범위를 표시한 것을 확인했고 Production 키·범위는 수정하지 않았다.
- 배포 및 수동 검증: Preview 환경으로만 재배포한 deployment `BEbHAJzSaBDTHhxFLW7FHWaCMhwc`가 Ready(34초)였다. 실제 홈에서 `30곳 연결된 성수 식당`, counted-only 세 반응, confirmed YouTube 근거를 확인했다. 실제 UUID 상세에서도 세 반응 분포(좋아요/그냥 그래요/싫어요), 개인 반응 분리 안내, 로그인·체크인 전 상태, confirmed 원본 영상만 표시되는 것을 확인했다.
- 현재 상태: WU-15는 더 이상 Supabase server secret 때문에 막히지 않으며 `진행 중`이다. 남은 실제 smoke는 `RATE_LIMIT_NETWORK_SALT` 설정 후 로그인·반응·체크인 성공/실패·복구 경로, Kakao 공개 앱 키가 준비된 경우 지도 SDK 경로, Preview의 390px/1440px 실제 데이터 회귀다. 현재 키가 없는 상태에서도 지도 fallback과 공개 목록은 정상 동작한다.

### 2026-08-26 — Preview rate limit 및 개인 반응 경로 검증

- 외부 설정: 사용자 승인으로 32바이트 난수 기반 `RATE_LIMIT_NETWORK_SALT`를 생성해 Vercel `acme/be-jarvis`의 **Preview 전용 Secret**으로 등록했다. 값은 로컬 파일·Git·채팅·개발일지에 저장하거나 출력하지 않았고 Production 환경에는 등록하지 않았다.
- 배포: Preview deployment `aBZzirWwxSr3636UTHzXdoz1Dj3P`가 Ready(43초)였다. 소스는 Vercel이 표시한 `codex/ui-baseline`의 `a15293d`이며, Preview만 선택해 재배포했다.
- 수동 검증: 실제 식당 상세에서 비로그인 상태로 `좋아요`를 선택하자 브라우저 개인 취향 저장 안내가 표시되고, 방문 확인 공개 분포는 기존 12명(7/3/2)을 유지했다. 즉, 증명 없는 선택이 공개 집계를 0건·새 수치로 바꾸지 않는다.
- 자동 검증: `pnpm test -- tests/abuse-guard-api.test.ts tests/reaction-api.test.ts tests/visit-proof-api.test.ts tests/reaction-auth-ui.test.ts tests/visit-check-in.test.ts`를 실행해 Vitest 26개 파일 146개 성공·2개 skip을 확인했다. 이번 세션은 외부 환경 설정과 수동 smoke만 변경했으므로 lint/typecheck/build는 이전 성공 결과를 유지하고 재실행하지 않았다.
- 남은 실제 성공 검증: 계정의 비밀번호·사용자 식별자나 가짜 위치를 새로 만들지 않는다. 팀의 기존 테스트 계정으로 Preview에 직접 로그인하고, 테스트 가능한 실제 위치 권한을 허용한 뒤 체크인 성공→한 번의 반응→counted/held/private_only 결과와 재사용·권한 거부·거리 초과 복구를 확인해야 한다. Production에는 출시 단계에서 별도의 salt를 생성한다.

### 2026-08-26 — 체크인 성공 경로 재개 대기

- 확인: 새 Preview는 deployment별 도메인을 사용하므로 이전 Preview 도메인에서 만든 Supabase 로그인 세션과 브라우저 위치 권한이 새 배포에 자동으로 이어지지 않는다. 현재 Preview URL에서 UI는 로그인되지 않은 상태임을 확인했다.
- 재개 조건: 사용자가 현재 Preview URL에서 기존 테스트 계정으로 다시 로그인하고 위치 권한을 허용한 뒤 알려주면, 해당 동일 도메인에서 체크인·반응 공개 반영과 거부·재사용 경로를 이어서 검증한다. 자격 증명·원본 위치·가짜 위치는 요청하거나 저장하지 않는다.

### 2026-08-26 — 실제 데이터 반응형·접근성 Preview smoke

- 수동 검증: Ready 상태의 Preview `https://be-jarvis-ph1vbjp8q-acme-29f2.vercel.app`에서 실제 공개 데이터가 로딩된 뒤 홈과 식당 상세(UUID `...0003`)를 확인했다. 390×844 모바일과 1440×900 데스크톱 각각에서 홈의 30곳 목록·상세의 counted-only 세 반응과 개인 취향 분리 안내가 표시됐고, 가로 scroll width가 viewport보다 크지 않았다.
- 접근성 확인: 모바일 상세의 `좋아요` / `그냥 그래요` / `싫어요` 버튼이 role 기반으로 발견됐고, `Tab` 이동 후 `좋아요` 버튼에 키보드 포커스가 실제로 이동했다. 공개 크리에이터 방문 근거와 개인 취향 안내는 존재하며 평균점수 UI는 없음을 확인했다.
- 오류·복구 확인: 초기 로딩 상태 뒤 실제 데이터 화면으로 전환됐으며, 홈·상세 모두 오류 안내나 Next 오류 오버레이 없이 렌더링됐다. 새 코드·배포 설정은 바꾸지 않았으므로 lint/typecheck/build는 이번 확인에서 재실행하지 않고 이전 성공 결과를 유지한다.
- 남은 실제 성공 검증: 현재 Preview 도메인에서 기존 테스트 계정 로그인과 위치 권한을 다시 완료한 뒤 체크인→공개 반응 성공, 권한 거부·거리 초과·proof 재사용 실패 및 복구를 확인한다. Kakao 공개 앱 키가 준비되면 SDK 지도 경로만 별도 확인한다.

### 2026-08-26 — Kakao Preview SDK 설정·fallback 진단

- 외부 설정: 사용자 제공 `kakao.env`에서 `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`의 존재만 확인하고, 값을 출력·Git 기록·개발일지에 남기지 않았다. 이를 Vercel `acme-29f2/be-jarvis`의 **Config / Preview 전용** 환경변수로 등록했고 Production은 선택하지 않았다. 같은 `codex/ui-baseline` source commit `a15293d`을 Preview로 재배포했다.
- 배포 결과: deployment `HjWgtFkSzuxqA6AHC18D1jqyWgt7`가 Ready(34초)였다. URL은 `https://be-jarvis-8xhrbse0q-acme-29f2.vercel.app`, 안정 브랜치 alias는 `https://be-jarvis-git-codex-ui-baseline-acme-29f2.vercel.app`이다.
- 수동 검증: 두 Preview 도메인 모두 실제 30곳 공개 목록은 정상 표시됐고 Kakao SDK script tag도 포함됐지만, 11초 뒤 SDK load error fallback이 표시됐다. `window.kakao.maps`와 지도 canvas는 생성되지 않았다. 코드의 키 미설정 fallback이 아니라 SDK network error 경로임을 확인했다.
- 원인과 재개 조건: Kakao 공식 문서에 따라 Web 지도 SDK는 **JavaScript 키**를 사용하고, 해당 키의 **JavaScript SDK 도메인**에 호출 도메인을 등록해야 하며, 앱의 `카카오맵 > 사용 설정`도 ON이어야 한다. 현재 Kakao Developers Console은 로그인 화면이므로 앱 설정을 변경할 권한이 없다. 앱 소유자가 Console에서 위 안정 alias를 JavaScript SDK 도메인으로 등록하고 카카오맵 사용 설정을 ON으로 만든 뒤, 로그인 정보는 공유하지 말고 “도메인 등록 완료”라고만 알려주면 같은 Preview에서 map canvas·marker selection smoke를 재개한다.
- 범위와 검증: `KAKAO_REST_API_KEY`는 현재 UI가 REST API를 호출하지 않으므로 추가하지 않았다. 코드·Supabase·Production·package/lockfile은 변경하지 않았으며, 외부 환경 설정과 브라우저 smoke만 수행했으므로 lint/typecheck/test/build는 재실행하지 않고 이전 성공 결과를 유지한다.

### 2026-08-26 — Kakao 지도 SDK Preview smoke 성공

- 외부 재개 조건 해소: 앱 소유자가 Kakao Developers에서 카카오맵 사용 설정을 ON으로 바꾸고, JavaScript SDK 도메인에 안정 Preview alias를 등록했다고 알렸다. 자격 증명·키 값은 요청하거나 확인하지 않았다.
- 수동 검증: 안정 Preview alias를 새로고침한 뒤 지도 network fallback이 사라지고 `성수동 식당 Kakao 지도` region과 map canvas가 생성된 것을 확인했다. 지도 내부의 marker image 47개가 생성됐고, 가로 overflow도 없었다. 브라우저 자동화의 격리 평가에서는 page global인 `window.kakao`를 읽지 못했지만 실제 canvas·marker DOM이 생성돼 SDK 초기화의 사용자 화면 결과를 확인했다.
- 선택 동기화: `합성 성수 양식 03` 목록 선택 후 선택 시트, 공개 세 반응, confirmed 크리에이터 영상 근거, 상세 이동 링크가 함께 표시됐고 fallback은 계속 없었다. Kakao 마커 자체는 canvas 기반이라 접근성 locator로 직접 click하지 않았지만, 목록 선택과 map component의 동일 `selectedRestaurantId` 계약을 통해 동기화 경로를 확인했다.
- 남은 실제 성공 검증: WU-15는 기존 테스트 계정·현재 Preview 도메인의 위치 권한으로 체크인→공개 반응 성공, 권한 거부·거리 초과·proof 재사용 실패·복구를 확인할 때까지 `진행 중`이다.

### 2026-08-26 — Supabase 합성 테스트 계정·인증 반응 smoke

- 외부 상태 변경: Supabase Dashboard의 Be-jarvis Auth Users에서 이메일이 자동 확인된 합성 테스트 계정 1개를 만들었다. 실제 사람의 이메일을 사용하지 않았고, 계정 식별자·이메일·비밀번호·토큰은 채팅·Git·개발일지에 기록하지 않았다. 이 계정은 WU-15 체크인 성공 검증이 끝날 때까지 유지하고, 완료 시 sessions 정리 후 삭제한다.
- 인증 검증: 현재 안정 Preview 도메인의 식당 상세에서 이 계정으로 로그인에 성공했고, 체크인 제어가 활성화되는 것을 확인했다.
- 위치 실패·복구 검증: Chrome과 인앱 브라우저 양쪽에서 실제 위치를 요청했으나 위치 값이 응답하지 않아 앱의 `위치 확인 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.` 복구 상태를 확인했다. 가짜 GPS·원본 좌표 저장·권한 우회는 사용하지 않았다. 자동화 실행 환경이 위치 응답을 제공하지 않아 실제 체크인 성공·거리 초과·proof 재사용 검증은 아직 완료하지 못했다.
- 인증 후 반응 분리: 로그인한 테스트 계정이 체크인 전 `좋아요`를 선택하면 개인 반응으로 저장되고, 기존 공개 counted-only 분포 12명은 변하지 않음을 확인했다. 즉 인증만으로 공개 집계가 바뀌지 않는다.
- 다음 작업: 실제 위치를 제공하는 사용자의 브라우저에서 같은 Preview에 로그인한 상태로 체크인을 한 번 성공시키고, 그 뒤 한 번의 반응과 proof 재사용 거부·거리 초과·권한 거부 복구를 확인한다. 테스트 계정을 계속 쓸 경우 자격 증명은 채팅으로 전달하지 말고 이미 로그인된 브라우저 세션만 사용한다.

### 2026-08-26 — WU-15 자동 검증·합성 계정 정리

- 품질 게이트: Codex Node 런타임으로 `pnpm run lint`, `pnpm run typecheck`, `pnpm test`를 다시 실행했다. lint·typecheck는 성공했고 Vitest는 26개 파일 146개 성공·2개 파일 2개 skip이었다. 기본 `pnpm run build`는 worktree `node_modules` junction이 filesystem root 밖을 가리키는 Turbopack 환경 제한으로 실패했으며, 같은 소스의 `node node_modules/next/dist/bin/next build --webpack` production build는 성공했다.
- 실제 위치 재확인: Chrome과 인앱 브라우저에서 실제 위치 권한 요청을 다시 시도했지만 둘 다 위치 응답 시간 초과 복구 경로로 끝났다. 자동화 실행 환경이 위치 값을 제공하지 않는 상태이므로, 가짜 GPS·서버 직접 proof 생성·공개 집계 우회는 하지 않았다.
- 테스트 데이터 정리: 합성 테스트 계정의 삭제 대상을 Dashboard에서 확인한 뒤 삭제했다. 삭제 dialog가 닫히고 Auth Users 총수가 생성 전 15명으로 돌아온 것을 확인했다. 이메일·비밀번호·UID·토큰·원본 위치는 기록하지 않았다.
- WU-15의 유일한 미완료: 실제 위치를 반환하는 브라우저에서 120m·정확도 100m 조건을 충족한 체크인 성공 → 반응 1회 → counted/held/private_only 결과 확인 → 같은 proof 재사용 거부를 확인해야 한다. 권한 거부와 거리 초과도 같은 실제 기기에서 복구 안내를 확인한다. 이 외의 Preview 공개 데이터·반응형·Kakao·인증·개인 반응·자동 품질 게이트는 검증됐다.

### 2026-08-26 — 독립 디자인 기준선의 앱 셸 재이식

- 배경과 판단: 사용자가 `origin/codex/kakao-map-update`의 형제 디자인이 현재 Preview에 사실상 반영되지 않았다고 보고했다. 해당 원격은 `main`과 merge-base가 없고 `Be-Jarvis-main/` 중첩 루트를 포함하므로 merge·cherry-pick·전체 폴더 복사는 하지 않았다. 소스의 모바일 앱 셸, 지도 우선 배치, 하단 선택 시트라는 시각 기준만 현재 WU-15 화면에 수동 적용했다.
- 구현: 홈의 큰 소개형/데스크톱 2열 페이지를 390px 기준의 중앙 앱 카드로 바꾸고, 간결한 상단 브랜드·위치 표시, 지도 우선 영역, 가로 스크롤 식당 카드 구조를 만들었다. 선택한 식당은 지도 안쪽 하단 시트로 표시해 세 반응, 개인 매칭, confirmed-only 영상과 상세 링크를 한 화면에서 제공한다. 식당 상세도 같은 앱 카드 비율과 고정 행동 바로 맞췄다.
- 보존한 계약: 실제 Supabase 공개 목록·상세 DTO, Kakao 지도/marker 및 `selectedRestaurantId` 동기화, 인증·반응·체크인 UI, confirmed-only YouTube 근거, 공개 반응과 개인 매칭 분리를 그대로 유지했다. mock 식당·엑셀 데이터·점수/별점·새 API 호출·전역 CSS·자산은 추가하지 않았다.
- 검증: `git diff --check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm test`(146 passed, 2 skipped), `node node_modules/next/dist/bin/next build --webpack`을 통과했다. 실행 중인 로컬 서버의 `/?snapshot=1`은 HTTP 200이며 새 앱 셸 마크업을 반환했다. 이 환경에는 `agent-browser` 실행 파일이 없어 390px/1440px 스크린샷 수동 검증은 미실행으로 남겼다.
- 변경 파일: `src/app/page.tsx`, `src/app/page.module.css`, `src/app/restaurants/[id]/page.module.css`, `src/components/map/map-explorer.module.css`, `src/components/map/selected-restaurant-sheet.module.css`, 이 일지와 `INDEX.md`.
- 다음 작업에서는 어떻게 해야 하는가: Preview에 이 커밋을 올린 뒤 실제 390px 및 1440px에서 지도 canvas, 카테고리 재선택 해제, 목록/마커 선택 시트, 상세 반응·체크인 화면을 확인한다. 그 뒤 실제 위치 응답 기기에서 WU-15의 남은 체크인 성공·재사용 거부·권한 거부·거리 초과 smoke를 진행한다. `codex/mobile-map-prototype`와 같은 홈/상세 충돌 브랜치의 통합 담당이 정해지기 전에는 push하지 않는다.
