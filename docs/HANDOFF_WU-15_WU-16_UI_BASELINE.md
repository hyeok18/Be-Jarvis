# WU-15/WU-16 UI 기준선·발표 백업 인계

이 문서는 사용량이 부족하거나 다른 팀원이 바로 이어받아야 할 때를 위한 단일 인계 문서다.

## 1. 현재 위치

- 작업 폴더: `C:\Users\user\Desktop\ai 3일차\Be-Jarvis-ui-baseline`
- 브랜치: `codex/ui-baseline`
- 최신 로컬 커밋은 `git log -1 --oneline`으로 확인한다.
- 이 문서에 기록된 커밋 목록은 인계 시점의 참고용이다. 최신 로컬 커밋은 항상 `git log -1 --oneline`으로 확인한다.
- 직전 커밋:
  - `8643668 docs: record snapshot build verification`
  - `1a96f2a docs: add WU-15 WU-16 handoff`
  - `ca0b589 feat: add presentation snapshot mode`
  - `7304340 docs: record UI baseline push blockers`
  - `26e06b7 feat: establish UI baseline for WU-15 integration`
  - `d1944fa docs: record Vercel preview security block`
  - `d68a2e8 feat: connect public restaurant data to UI`
  - `a71c52b refactor: isolate WU-15 UI fixture boundaries`
- 작업 트리 상태: 마지막 확인 시 clean
- push/PR 상태: 아직 push하지 않음

## 2. 현재 결론

시간이 부족하므로 아래 항목은 스킵하고 나중 세부 구현에서 이어간다.

- 기존 YouTube API 키 폐기·신규 키 발급·Vercel Preview 등록
- 실제 Preview smoke test
- Production 배포
- `codex/mobile-map-prototype` 충돌 조정 후 PR 생성
- 발표 리허설과 발표 자료 작성

대신 지금 사용할 수 있는 최소 발표 경로를 만들었다.

- 홈 발표 백업: `/?snapshot=1`
- 상세 발표 백업 예시: `/restaurants/restaurant-balanced-bowl?snapshot=1`
- 30초 자동 발표 순환 시작: `/?snapshot=1&cycle=1`
- 30초 자동 발표 순환 상세 예시: `/restaurants/restaurant-balanced-bowl?snapshot=1&cycle=1`

이 백업 모드는 합성 fixture를 명시적으로 사용하는 발표용 화면이다. 실제 Supabase/YouTube 데이터 실패를 조용히 mock으로 바꾸지 않고, 화면에 `발표 백업 모드` 안내를 표시한다.

## 3. 구현된 것

### WU-15 UI 기준선

- 홈 지도·목록·선택 시트·상세 화면 UI 기준선 정리
- 실제 공개 DTO 연결 경계 유지
- 503 실패 시 빈 0건으로 바꾸지 않고 `PublicDataUnavailable` 표시
- 별점, 평균점수, 종합점수, 신뢰도 점수 추가 없음
- 공개 반응은 `좋아요 / 그냥 그래요 / 싫어요`만 표현
- confirmed-only 크리에이터 방문 근거만 UI에 전달
- `src/app/api/`, `src/server/`, `src/contracts/`, `supabase/migrations/`, `package.json`, `pnpm-lock.yaml`는 UI 기준선 작업에서 건드리지 않음

### WU-16 최소 발표 백업

- `?snapshot=1` 홈 백업 모드
- `?snapshot=1` 상세 백업 모드
- `?snapshot=1&cycle=1` 홈·대표 상세 30초 자동 순환 모드
- 실제 데이터 실패 화면에서 `발표 백업 모드로 보기` 링크 제공
- 지도 목록과 선택 시트의 상세 링크가 snapshot query를 유지
- 관련 테스트 추가

## 4. 주요 변경 파일

- `src/app/page.tsx`
- `src/app/page.module.css`
- `src/app/restaurants/[id]/page.tsx`
- `src/app/restaurants/[id]/page.module.css`
- `src/app/globals.css`
- `src/components/presentation/presentation-snapshot-cycle.tsx`
- `src/components/map/map-explorer.tsx`
- `src/components/map/selected-restaurant-sheet.tsx`
- `src/components/public-data/public-data-unavailable.tsx`
- `src/components/public-data/public-restaurant-ui-adapter.ts`
- `src/components/map/map-explorer-fixture.ts`
- `src/components/restaurant-detail/restaurant-detail-fixture.ts`
- `tests/map-explorer-view-model.test.tsx`
- `tests/public-restaurant-ui-adapter.test.ts`
- `tests/restaurant-detail.test.tsx`
- `docs/development-logs/2026-08-26_WU-15_public-data-api.md`
- `docs/development-logs/2026-08-26_WU-16_presentation-snapshot.md`
- `docs/development-logs/INDEX.md`
- `docs/DEVELOPMENT_PRIORITY.md`

정확한 전체 변경 파일은 아래로 확인한다.

```powershell
git diff --name-only origin/main...HEAD
```

## 5. 검증 기록

이미 통과한 검증:

- UI 기준선 구현 후:
  - lint 성공
  - typecheck 성공
  - Vitest 143 passed, 2 skipped
  - Next.js 16.3.2 Webpack production build 성공
  - 390x844, 1440x900 홈·상세 브라우저 확인 성공
- 발표 백업 모드 추가 후:
  - 관련 테스트 2개 파일, 19개 테스트 통과
  - 전체 Vitest 146 passed, 2 skipped
  - typecheck 성공
  - lint 성공
  - Next.js 16.3.2 Webpack production build 성공
  - Webpack dev 서버에서 `/?snapshot=1`, `/restaurants/restaurant-balanced-bowl?snapshot=1` HTTP 200 확인
  - Webpack dev 서버에서 `/?snapshot=1&cycle=1`, `/restaurants/restaurant-balanced-bowl?snapshot=1&cycle=1` HTTP 200 확인

발표 백업 모드 추가 후 아직 미실행:

- Preview smoke
- 발표 리허설과 발표 자료 작성

Node/PATH 이슈가 있을 때는 아래처럼 번들 Node 절대경로로 실행했다.

```powershell
& "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" node_modules\vitest\vitest.mjs run tests/map-explorer-view-model.test.tsx tests/restaurant-detail.test.tsx
& "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" node_modules\typescript\bin\tsc --noEmit
& "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" node_modules\eslint\bin\eslint.js .
& "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" node_modules\next\dist\bin\next build --webpack
```

pnpm이 `node_modules` purge 확인에서 막히거나 `.bin`이 깨지면 아래로 복구했다.

```powershell
pnpm install --frozen-lockfile --config.confirmModulesPurge=false
```

## 6. push/PR이 막힌 이유

push 전 안전검사를 최신 원격 fetch 포함으로 재시도했고, 아래 브랜치 문제 때문에 멈춘 상태다.

- 실행: 번들 Node로 `scripts/check-push-safety.mjs`
- 결과: `origin/main...origin/codex/kakao-map-update` 비교에서 `no merge base`
- 결론: feature branch도 아직 push하지 않는다.

1. `origin/codex/kakao-map-update`
   - `origin/main`과 merge-base가 없다.
   - 직접 merge, cherry-pick, 전체 복사 금지.
   - 디자인 참고만 가능했던 독립 기준선이다.

2. `origin/codex/mobile-map-prototype`
   - `codex/ui-baseline`과 아래 파일이 겹친다.
   - `src/app/page.tsx`
   - `src/app/restaurants/[id]/page.tsx`

따라서 팀에서 `mobile-map-prototype`의 홈/상세 변경을 폐기할지, `codex/ui-baseline`에 흡수할지, 별도 통합 담당이 처리할지 정하기 전에는 push하지 않는다.

## 7. 보안 블로커

이전 세션에서 YouTube API 키가 브라우저 자동화 폼 출력에 노출됐을 가능성이 있다.

반드시 지킬 것:

- 기존 YouTube 키는 재사용하지 않는다.
- Google Cloud Console에서 기존 키를 폐기한다.
- 새 키를 서버 전용으로 발급한다.
- 키 값은 채팅, 터미널 요약, 개발일지, Git diff에 남기지 않는다.
- 새 키 준비 전에는 YouTube sync, Cron, Preview smoke를 재개하지 않는다.

## 8. 다음 팀원의 추천 진행 순서

### 사용량 5% 근접 또는 컨텍스트 부족 시 자동 인계 프로토콜

현재 Codex 도구에는 `사용량이 정확히 5% 남았을 때`를 조건으로 트리거하는 자동화가 없다. 따라서 이 작업을 이어받는 AI나 팀원은 사용량·컨텍스트가 위험해 보이면 즉시 아래 순서로 멈추고 인계한다.

1. `git status --short --branch`로 작업 트리 상태를 확인한다.
2. 진행 중 변경이 있으면 관련 개발일지와 이 인계 문서를 최신 상태로 갱신한다.
3. 안전한 범위의 파일만 커밋한다.
4. push는 충돌/키 블로커가 해결되기 전까지 하지 않는다.
5. 최종 메시지에 브랜치, 최신 커밋, 변경 파일, 미실행 검증, 다음 재개 지점을 남긴다.
6. 다음 담당자에게 이 문서 경로를 먼저 전달한다.

긴 작업을 시작할 때는 완성 전까지 기다리지 말고, 기능 단위 하나가 끝날 때마다 이 문서와 개발일지를 갱신한다.

## 9. 다음 팀원의 추천 진행 순서

시간이 없고 발표가 우선이면:

1. `codex/ui-baseline`에서 앱을 실행한다.
2. 자동 전환이 필요하면 `/?snapshot=1&cycle=1`로 시작한다.
3. 수동 전환이 필요하면 `/?snapshot=1`과 `/restaurants/restaurant-balanced-bowl?snapshot=1`을 직접 연다.
4. 발표에서는 이것을 `발표 백업 모드`라고 명확히 말한다.
5. 실제 데이터·Preview 성공 경로는 세부 구현 때 이어간다.

세부 구현을 이어갈 때:

1. 기존 YouTube 키 폐기와 새 키 준비를 먼저 끝낸다.
2. `codex/mobile-map-prototype`와 `codex/kakao-map-update`의 처리 방침을 팀에서 확정한다.
3. 실제 데이터 화면은 Preview smoke에서 다시 확인한다.
4. 발표 전에는 최소 3회 리허설한다.
5. 안전검사 통과 후 feature branch만 push하고 PR을 만든다.

## 10. 다음 AI에게 줄 프롬프트

아래를 그대로 붙여넣으면 된다.

```text
Be-Jarvis의 `codex/ui-baseline` 브랜치에서 이어가 주세요.

먼저 `AGENTS.md`, `PRD.md`, `docs/VISION_ROADMAP.md`, `docs/DEVELOPMENT_PRIORITY.md`, `docs/development-logs/INDEX.md`, `docs/HANDOFF_WU-15_WU-16_UI_BASELINE.md`, `docs/development-logs/2026-08-26_WU-15_public-data-api.md`, `docs/development-logs/2026-08-26_WU-16_presentation-snapshot.md`, `docs/TEAM_GIT_GUIDE.md`를 읽으세요.

현재 상황:
- 브랜치: `codex/ui-baseline`
- 최신 로컬 커밋은 `git log -1 --oneline`으로 확인하세요.
- WU-15 UI 기준선과 WU-16 최소 발표 백업 모드는 구현되어 있습니다.
- 홈 백업 URL: `/?snapshot=1`
- 상세 백업 URL 예시: `/restaurants/restaurant-balanced-bowl?snapshot=1`
- 자동 순환 시작 URL: `/?snapshot=1&cycle=1`
- 실제 데이터 실패 화면은 자동 mock으로 바꾸지 않고, 명시적 `발표 백업 모드로 보기` 링크만 제공합니다.

스킵하기로 한 것:
- YouTube 키 폐기·신규 키 등록
- Vercel Preview smoke
- Production 배포
- 발표 리허설과 발표 자료 작성
- push/PR 충돌 조정

주의:
- 기존 YouTube API 키는 노출 가능성이 있으므로 절대 재사용하지 마세요.
- `origin/codex/kakao-map-update`는 origin/main과 merge-base가 없으므로 merge/cherry-pick/전체 복사하지 마세요.
- `origin/codex/mobile-map-prototype`는 `src/app/page.tsx`, `src/app/restaurants/[id]/page.tsx`가 겹치므로 팀 결정 전 push하지 마세요.
- 별점, 평균점수, 종합점수, 신뢰도 점수는 추가하지 마세요.
- 공개 반응은 좋아요/그냥 그래요/싫어요만 유지하세요.
- Supabase migration, API, server logic, package.json, pnpm-lock.yaml은 이번 UI/백업 범위에서 건드리지 마세요.

다음 우선순위:
1. 발표가 급하면 `/?snapshot=1&cycle=1`을 실행해 30초 자동 순환을 확인하세요.
2. 시간이 생기면 발표 리허설과 발표 자료를 만드세요.
3. 세부 구현 단계에서는 YouTube 키 폐기·신규 키 등록과 Preview smoke를 재개하세요.
4. push 전에는 `git fetch --prune origin`과 `pnpm run check:push-safety`를 실행하고, 위 충돌 브랜치 처리 담당이 정해졌는지 확인하세요.
```

## 11. 절대 하지 말 것

- `main` 직접 push
- force push
- `git reset --hard`
- YouTube 기존 키 재사용
- API 키·토큰·비밀번호 출력
- `codex/kakao-map-update` 통째 복사
- 실제 데이터 실패를 조용히 fixture로 대체
- 별점·평균·종합점수·신뢰도 UI 부활
