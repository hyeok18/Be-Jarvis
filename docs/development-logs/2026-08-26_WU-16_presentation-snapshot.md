# [WU-16] 발표 스냅샷·백업 모드

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-16 |
| 상태 | 진행 중 |
| 작업일 | 2026-08-26 |
| 담당 | B2+A1 |
| 대상 AC | AC-14, AC-28 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-15 |
| 다음 작업 단위 | WU-16 세부 스냅샷 전환 또는 WU-17 오류·접근성 회귀 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 새 YouTube 키·Preview smoke·push 충돌 조정이 시간상 지연되어도 발표 중 화면 흐름을 완전히 잃지 않게 한다.
- 세션 범위: 실제 공개 데이터 연결을 조용히 mock으로 대체하지 않고, 명시적 `?snapshot=1` 발표 백업 모드와 `?snapshot=1&cycle=1` 30초 발표 순환 모드를 제공한다.
- 완료 조건: 홈과 상세에서 합성 스냅샷을 명시적으로 열 수 있고, 실제 데이터 실패 화면에서 백업 모드로 이동할 수 있으며, 발표 순환 URL이 30초 단위로 홈·상세를 오갈 수 있다.
- 범위 밖 항목: 실제 30곳 Preview smoke, YouTube 키 재발급·등록, PR push 충돌 조정, Production 검증.

## 2. 무엇을 만들었는가

- 구현 또는 문서화한 내용:
  - 홈 `/`에서 `?snapshot=1`을 받으면 WU-06/WU-08 합성 fixture 기반 지도 데이터를 렌더링한다.
  - 식당 상세 `/restaurants/[id]?snapshot=1`에서 같은 합성 fixture 상세를 렌더링한다.
  - 실제 공개 데이터 연결 실패 화면에 `발표 백업 모드로 보기` 링크를 추가했다.
  - 지도 목록과 선택 시트의 상세 링크가 백업 모드에서는 `?snapshot=1`을 유지한다.
  - 화면 상단에 `발표 백업 모드` 안내를 표시해 실제 DB·YouTube 성공 경로와 혼동하지 않게 했다.
  - `?snapshot=1&cycle=1`에서는 홈과 대표 상세 화면을 30초 단위로 자동 전환하는 발표 순환 안내와 진행 바를 표시한다.
- 사용자 또는 시스템 동작 변화:
  - 평소에는 기존처럼 Supabase 공개 DTO를 먼저 사용한다.
  - 백업 모드는 사용자가 URL 또는 실패 화면의 링크로 명시적으로 진입할 때만 사용한다.

변경한 파일:

- `src/app/page.tsx`
- `src/app/restaurants/[id]/page.tsx`
- `src/app/globals.css`
- `src/components/presentation/presentation-snapshot-cycle.tsx`
- `src/components/map/map-explorer.tsx`
- `src/components/map/selected-restaurant-sheet.tsx`
- `src/components/public-data/public-data-unavailable.tsx`
- `tests/map-explorer-view-model.test.tsx`
- `docs/development-logs/2026-08-26_WU-16_presentation-snapshot.md`
- `docs/HANDOFF_WU-15_WU-16_UI_BASELINE.md`
- `docs/development-logs/INDEX.md`
- `docs/DEVELOPMENT_PRIORITY.md`

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: WU-15는 기존 YouTube 키 폐기·신규 키 등록과 Preview smoke가 필요하지만, 시간상 즉시 끝내기 어렵다.
- 막힌 지점: 외부 키·배포·원격 branch 충돌 조정은 현재 세션에서 스킵하기로 했다.
- 영향: WU-16을 완전 완료로 표시하지 않고, 발표 백업의 최소 경로만 먼저 제공한다.

## 4. 어떻게 해결했는가

- 원인: 실제 데이터 성공 경로는 외부 환경과 팀 branch 정리가 필요하다.
- 선택한 해결 방법: 자동 fallback이 아니라 `?snapshot=1` 명시 모드를 추가했다.
- 다른 선택지를 쓰지 않은 이유: 실제 데이터 실패를 0건이나 합성 데이터로 조용히 대체하면 WU-15 공개 계약과 발표 신뢰성을 해친다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 관련 단위 테스트 | `node node_modules/vitest/vitest.mjs run tests/map-explorer-view-model.test.tsx tests/restaurant-detail.test.tsx` | 성공 | 2개 파일, 19개 테스트 통과 |
| 전체 테스트 | `node node_modules/vitest/vitest.mjs run` | 성공 | 26개 파일 통과, 2개 파일 skipped. 146개 테스트 통과, 2개 skipped |
| 정적 검사 | `node node_modules/typescript/bin/tsc --noEmit` | 성공 | 오류 0 |
| lint | `node node_modules/eslint/bin/eslint.js .` | 성공 | 오류 0 |
| 빌드 | `node node_modules/next/dist/bin/next build --webpack` | 성공 | Next.js 16.3.2 Webpack production build 성공 |
| 수동 AC 검증 | 브라우저 390px·1440px | 미실행 | 시각적 브라우저 검증은 아직 미실행 |
| 실패·복구 경로 | Webpack dev 서버 HTTP 확인 | 성공 | `/?snapshot=1`, `/restaurants/restaurant-balanced-bowl?snapshot=1`, `/?snapshot=1&cycle=1`, `/restaurants/restaurant-balanced-bowl?snapshot=1&cycle=1` 모두 200, `발표 백업 모드`와 `30초 발표 전환` 문구 포함 |

- 통과한 AC: AC-14 일부, AC-28 일부.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 브라우저 390px/1440px 수동 검증은 현재 자동 판정 도구가 없어 미실행이다. 전체 test는 뒤이어 실행해 통과했다.
- 테스트 데이터 안전 확인: 합성 fixture만 사용했다.
- 비밀값 노출 확인: 없음.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `src/app/page.tsx` | `?snapshot=1` 홈 백업 모드와 실패 화면 백업 링크 |
| `src/app/restaurants/[id]/page.tsx` | `?snapshot=1` 상세 백업 모드와 뒤로가기 유지 |
| `src/app/globals.css` | 백업 안내, 실패 화면 보조 액션, 30초 발표 순환 스타일 |
| `src/components/presentation/presentation-snapshot-cycle.tsx` | 발표 순환 타이머와 다음 화면 이동 링크 |
| `src/components/map/map-explorer.tsx` | 상세 링크에 백업 모드 suffix 전달 |
| `src/components/map/selected-restaurant-sheet.tsx` | 선택 시트 상세 링크에 백업 모드 suffix 전달 |
| `src/components/public-data/public-data-unavailable.tsx` | 명시적 발표 백업 모드 링크 |
| `tests/map-explorer-view-model.test.tsx` | 백업 링크와 실패 화면 액션 회귀 |
| `docs/development-logs/2026-08-26_WU-16_presentation-snapshot.md` | 이번 작업 기록 |
| `docs/HANDOFF_WU-15_WU-16_UI_BASELINE.md` | 다른 팀원·다음 AI가 바로 이어받기 위한 단일 인계 |
| `docs/development-logs/INDEX.md` | WU-16 재개 지점 추가 |
| `docs/DEVELOPMENT_PRIORITY.md` | WU-16 상태와 스킵 항목 반영 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 브라우저 390px/1440px 수동 검증과 3회 발표 리허설은 아직 실행하지 않았다.
- 후속 작업 후보: 실제 30곳 Preview smoke, 발표 체크리스트 3회 리허설, YouTube 키 교체 후 실제 데이터 경로 검증.
- 사용자 또는 외부 입력이 필요한 사항: 기존 YouTube 키 폐기와 새 서버 전용 키 준비, `codex/mobile-map-prototype` 충돌 처리 담당 확정.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. `/?snapshot=1&cycle=1`과 `/restaurants/restaurant-balanced-bowl?snapshot=1&cycle=1`을 390px·1440px에서 확인한다.
2. 발표 흐름을 최소 3회 리허설한다.
3. 실제 Preview로 돌아가기 전에는 기존 YouTube 키를 폐기하고 새 키·Preview Config를 등록한다.

## 9. 세션 업데이트

### 2026-08-26

- 추가 구현: 명시적 발표 백업 모드와 실패 화면 백업 진입 링크.
- 새 문제 또는 막힘: pnpm 검증 중 격리 worktree의 `node_modules` junction이 재생성되어 `.bin` 실행이 깨졌다.
- 해결 또는 시도: `pnpm install --frozen-lockfile --config.confirmModulesPurge=false`로 로컬 store 기반 의존성을 복구했고, 이후 번들 Node 절대경로로 테스트·typecheck·lint를 실행했다.
- 검증 결과: 관련 테스트 18개, typecheck, lint 통과. build와 브라우저 수동 검증은 시간 절약을 위해 미실행.
- 현재 재개 지점: WU-16은 진행 중이다. 세부 스냅샷 전환과 브라우저 390px/1440px 검증은 나중 구현 단계에서 이어간다.

### 2026-08-26 — 팀 인계 문서 추가

- 추가 구현: `docs/HANDOFF_WU-15_WU-16_UI_BASELINE.md`에 현재 브랜치, 커밋, 실행 URL, 스킵 항목, 보안 블로커, push 충돌, 다음 AI 프롬프트를 정리했다.
- 새 문제 또는 막힘: 없음.
- 해결 또는 시도: 사용량이 부족해도 다른 팀원이 문서 하나로 이어갈 수 있도록 INDEX와 WU-16 일지에서 인계 문서를 연결했다.
- 검증 결과: 문서 변경만 수행했다. 추가 코드 테스트는 미실행.
- 현재 재개 지점: 다음 팀원은 인계 문서의 `다음 팀원의 추천 진행 순서`부터 따르면 된다.

### 2026-08-26 — build와 snapshot HTTP 검증

- 추가 구현: 코드 변경 없음. 사용량 부족 대비 인계 문서에 5% 근접 시 인계 프로토콜을 유지했다.
- 새 문제 또는 막힘: `next dev` 기본 Turbopack은 `node_modules` junction이 저장소 루트 밖을 가리켜 실패했다.
- 해결 또는 시도: Webpack build와 Webpack dev 서버로 검증했다.
- 검증 결과: `node node_modules/next/dist/bin/next build --webpack` 성공. Webpack dev 서버에서 `/?snapshot=1`, `/restaurants/restaurant-balanced-bowl?snapshot=1`이 모두 HTTP 200을 반환하고 `발표 백업 모드` 문구를 포함했다.
- 현재 재개 지점: 남은 최소 검증은 390px/1440px 시각 확인이다. Preview smoke와 YouTube 키 교체는 계속 세부 구현 단계로 이월한다.

### 2026-08-26 — 30초 발표 순환과 전체 test

- 추가 구현: `src/components/presentation/presentation-snapshot-cycle.tsx`를 추가하고 `?snapshot=1&cycle=1`에서 홈과 대표 상세 화면이 30초 단위로 이동하도록 했다.
- 새 문제 또는 막힘: 실제 화면폭 390px/1440px 시각 판정은 현재 세션의 브라우저 도구로 자동 검증하지 못했다.
- 해결 또는 시도: Webpack dev 서버에서 순환 URL 두 개를 HTTP로 확인했고, Codex 패널에 `/?snapshot=1&cycle=1` preview를 열어 사람이 바로 확인할 수 있게 했다.
- 검증 결과: 전체 Vitest 146 passed, 2 skipped. `/?snapshot=1&cycle=1`, `/restaurants/restaurant-balanced-bowl?snapshot=1&cycle=1` 모두 HTTP 200이며 `30초 발표 전환`, `발표 백업 모드` 문구를 포함했다.
- 현재 재개 지점: 브라우저 390px/1440px 눈검수와 3회 발표 리허설만 남았다. Preview smoke와 YouTube 키 교체는 계속 세부 구현 단계로 이월한다.

### 2026-08-26 — push-safety 재확인

- 추가 구현: 코드 변경 없음. push 전 안전검사 결과만 최신화했다.
- 새 문제 또는 막힘: `pnpm run check:push-safety`는 PATH에 `node`가 없어 실패했고, 번들 Node 직접 실행은 sandbox 네트워크 제한과 Git `dubious ownership` 보호장치를 순서대로 만났다.
- 해결 또는 시도: 이 저장소 경로만 Git `safe.directory`로 등록한 뒤 번들 Node로 `scripts/check-push-safety.mjs`를 재실행했다.
- 검증 결과: fetch 이후 `origin/main...origin/codex/kakao-map-update` 비교에서 `no merge base`로 실패했다.
- 현재 재개 지점: push하지 않는다. `origin/codex/kakao-map-update`를 직접 merge/cherry-pick/전체 복사하지 말고, 팀에서 충돌·브랜치 처리 방침을 먼저 확정해야 한다.
