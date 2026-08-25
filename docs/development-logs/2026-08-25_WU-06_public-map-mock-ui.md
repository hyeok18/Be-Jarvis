# [WU-06] 공개 지도 셸과 mock 반응·매칭 UI

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-06 |
| 상태 | 진행 중 |
| 작업일 | 2026-08-25 |
| 담당 | A3 (A1 인계) |
| 대상 AC | AC-01~05, AC-20~22 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md), [A3 인계서](../HANDOFF_A3_WU-06_WU-08.md) |
| 선행 작업 | WU-05, WU-07 |
| 다음 작업 단위 | WU-08 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 별점이나 종합점수 없이 공개 반응 분포와 개인 매칭을 서로 혼동하지 않고 탐색할 수 있어야 한다.
- 세션 범위: 공개 지도 목록의 합성 반응 분포, 0건·10건 미만 상태, 개인 매칭 탭, 제외 음식 하드 필터를 구현한다.
- 완료 조건: WU-07 지도 계약을 보존하고 관련 자동 테스트와 390×844·1440×900 수동 검증을 모두 통과한다.
- 범위 밖 항목: 식당 상세·실제 반응 입력(WU-08), Auth·반응 저장(WU-09), 위치 체크인(WU-10).

## 2. 무엇을 만들었는가

- 구현 또는 문서화한 내용: A1 인계 브랜치를 최신 `main` 기반 격리 브랜치에 병합하고, 공개 반응·개인 매칭 탭과 전용 카드 표시를 구현했다.
- 사용자 또는 시스템 동작 변화: 공개 반응에서는 counted-only 세 반응과 0건·10건 미만 안내를, 개인 매칭에서는 매칭 순서·근거·신호 부족 안내를 본다. 먹지 않는 음식 식당은 개인 매칭 목록과 지도에서 빠진다.

변경한 파일:

- `docs/DEVELOPMENT_PRIORITY.md`
- `docs/development-logs/INDEX.md`
- `docs/development-logs/2026-08-25_WU-06_public-map-mock-ui.md`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/components/map/map-explorer.tsx`
- `src/components/map/map-view-model.ts`
- `src/components/map/reaction-distribution.tsx`
- `src/components/map/personal-match-summary.tsx`
- `src/domain/fixtures.ts`
- `tests/map-explorer-view-model.test.tsx`
- `vitest.config.ts`

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: A1 브랜치에는 UI 코드가 아니라 인계 문서만 있었다.
- 막힌 지점: 없음. 최신 `main`의 WU-07 지도 구현을 기반으로 새로 구현하기로 했다.
- 영향: 기존 지도 계약을 먼저 회귀 검증한 뒤 WU-06 UI를 추가한다.

## 4. 어떻게 해결했는가

- 원인: A1이 작업을 구현하지 않고 A3에게 명시적으로 인계했다.
- 선택한 해결 방법: 최신 `origin/main`에서 격리 worktree를 만들고 A1 인계 commit을 merge한 뒤 36개 기준 테스트를 통과시켰다.
- 다른 선택지를 쓰지 않은 이유: 오래된 A1 로컬 UI를 추정해 복원하면 WU-07·WU-17 변경을 덮을 위험이 있다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 관련 단위 테스트 | `node node_modules/vitest/vitest.mjs run` | 성공 | 8개 파일, 42/42 |
| 정적 검사 | `tsc --noEmit`, `eslint .` | 성공 | 오류 0 |
| 빌드 | `next build --webpack` | 성공 | Next.js 16.3.2 정적 홈 생성 |
| 수동 AC 검증 | 390×844, 1440×900 | 미실행 | 구현 후 실행 예정 |
| 실패·복구 경로 | 지도 키 없음 fallback·빈 필터 상태 | 미실행 | 구현 후 실행 예정 |

- 통과한 AC: 자동 검증 기준 AC-01~04, AC-20~22. 수동 UI 검증은 남아 있다.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 390×844·1440×900 브라우저 검증은 다음 체크포인트에서 실행한다.
- 테스트 데이터 안전 확인: 합성 데이터만 사용.
- 비밀값 노출 확인: 없음.

테스트를 실행하지 않았거나 실패했다면 상태를 `완료`로 쓰지 않는다.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `docs/DEVELOPMENT_PRIORITY.md` | WU-06 시작 상태 기록 |
| `docs/development-logs/INDEX.md` | 새 개발일지와 재개 지점 연결 |
| `docs/development-logs/2026-08-25_WU-06_public-map-mock-ui.md` | 구현·검증·인계 이력 기록 |
| `src/app/page.tsx` | 서버에서 합성 개인 매칭 결과 계산 |
| `src/app/globals.css` | 탭·반응 분포·개인 매칭·반응형 스타일 |
| `src/components/map/map-explorer.tsx` | 공개 반응과 개인 매칭 탐색 모드 통합 |
| `src/components/map/map-view-model.ts` | 반응 상태·매칭 정렬·제외 태그 표시 규칙 |
| `src/components/map/reaction-distribution.tsx` | 세 반응 counted-only 분포와 데이터 부족 표시 |
| `src/components/map/personal-match-summary.tsx` | 개인 매칭 수치·근거·cold-start 안내 |
| `src/domain/fixtures.ts` | 0건 상태를 포함한 합성 식당·취향 데이터 |
| `tests/map-explorer-view-model.test.tsx` | 공개 반응과 하드 제외 회귀 테스트 6개 |
| `vitest.config.ts` | TSX 컴포넌트 테스트 검색 허용 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 전역 스타일과 지도 목록 컴포넌트는 팀 병렬 작업과 충돌 가능성이 높다.
- 후속 작업 후보: WU-08 식당 상세·한 탭 반응 UI.
- 사용자 또는 외부 입력이 필요한 사항: 없음.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. 공개 반응과 개인 매칭을 탭으로 분리하고 개인 매칭 순서를 합성 데이터로 구현한다.
2. 제외 음식 식당이 개인 매칭 결과와 지도에서 빠지는지 자동·수동 검증한다.
3. 품질 게이트와 두 viewport 검증을 모두 통과해야 WU-08로 넘어간다.

## 9. 세션 업데이트

### 2026-08-25

- 추가 구현: 공개 반응·개인 매칭 탭, 세 반응 분포, 0건·10건 미만 안내, 매칭 근거, 제외 음식 하드 필터.
- 새 문제 또는 막힘: 없음.
- 해결 또는 시도: 최신 main 격리 worktree에서 인계 브랜치를 충돌 없이 병합.
- 검증 결과: lint·typecheck·42개 테스트·Webpack production build·환경 계약 통과.
- 현재 재개 지점: 390×844·1440×900 브라우저 수동 검증과 실패·복구 상태 확인.
