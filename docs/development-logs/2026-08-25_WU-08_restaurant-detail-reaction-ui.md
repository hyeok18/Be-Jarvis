# [WU-08] 식당 상세·한 탭 반응·개별 영상 근거 UI

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-08 |
| 상태 | 완료 |
| 작업일 | 2026-08-25 |
| 담당 | A3 (A1 인계) |
| 대상 AC | AC-01~05, AC-15, AC-17~18 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md), [WU-06 일지](./2026-08-25_WU-06_public-map-mock-ui.md) |
| 선행 작업 | WU-06 완료 |
| 다음 작업 단위 | WU-09 Auth·실제 반응 API UI 연결 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 지도에서 선택한 식당의 세 반응, 개인 매칭, 확인된 영상 근거와 방문 증명 상태를 상세 화면에서 오해 없이 확인하고 반응을 한 번에 선택할 수 있어야 한다.
- 세션 범위: 동적 상세 route, 세 반응 한 탭 선택 UI, 공개·개인 저장 조건 안내, confirmed 영상 근거, 지도 카드의 상세 이동.
- 완료 조건: 금지 점수 없이 390×844·1440×900, 키보드, 404, 반응 선택·변경, 영상 원본 링크와 전체 품질 게이트를 통과한다.
- 범위 밖 항목: Supabase Auth 화면·실제 access token 발급(WU-09), 실제 위치 proof(WU-10), rate limit(WU-11).

## 2. 무엇을 만들었는가

- 구현 또는 문서화한 내용: 세 합성 식당의 SSG 상세 route, 공개 반응 분포, 개인 매칭·제외 설명, 세 반응 한 탭 선택, 버전된 브라우저 로컬 저장, 방문 미인증 공개 제외 안내, confirmed·fresh YouTube 원본 근거 목록을 구현했다.
- 사용자 또는 시스템 동작 변화: 지도 카드에서 상세 화면으로 이동할 수 있고, `좋아요`·`그냥 그래요`·`싫어요` 중 하나를 선택·변경하면 이 기기의 개인 취향으로만 복원된다. 공개 반응 수는 변하지 않는다.

변경한 파일:

- `src/app/restaurants/[id]/page.tsx`
- `src/components/restaurant-detail/*`
- `src/components/map/map-explorer.tsx`
- `src/app/globals.css`
- `tests/restaurant-detail.test.tsx`
- `README.md`
- `docs/DEVELOPMENT_PRIORITY.md`
- `docs/development-logs/INDEX.md`
- `docs/development-logs/2026-08-25_WU-08_restaurant-detail-reaction-ui.md`

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: A1 prototype은 클라이언트 토글만으로 방문 확인 완료를 표현하고, 합성 구독자 라벨·YouTube 홈 링크·영업시간·거리 같은 미확인 정보를 표시했다. 실제 `/api/reactions`는 UUID 식당 ID와 bearer token을 요구하지만 WU-06 fixture ID는 slug이고 Auth client가 아직 없다.
- 막힌 지점: 격리 worktree의 `node_modules` Junction 때문에 `pnpm`은 공유 의존성 재설치를 시도했고, 기본 Turbopack 빌드는 filesystem root 밖 symlink를 거부했다. 최초 `notFound()` 구현은 복구 화면은 보였지만 production HTTP 상태가 `200`이었다.
- 영향: 공유 의존성을 삭제하지 않고 직접 Node 품질 명령과 webpack production build를 사용했다. WU-09 실제 저장 호출은 후속 통합으로 분리했고, 미등록 식당 ID의 HTTP 상태를 수정했다.

## 4. 어떻게 해결했는가

- 원인: A1 prototype이 WU-06·08 시각 흐름을 한 client page에 섞었고 WU-09·10 서버 경계보다 먼저 작성됐다. Next 동적 segment의 `dynamicParams` 기본값은 미생성 ID를 요청 시 렌더링한다.
- 선택한 해결 방법: 상세 `page.tsx`는 async `params`를 받는 Server Component와 `generateStaticParams`·`notFound()`·`dynamicParams = false`로 만들고, 로컬 반응 선택만 작은 Client Component로 분리했다. 로컬 저장은 `v1` 키와 식당 ID→세 반응 값만 보관하고 읽기·쓰기 실패를 처리한다. 영상은 WU-06과 동일한 confirmed·fresh fixture 원값만 사용했다.
- 다른 선택지를 쓰지 않은 이유: prototype 전체 병합은 WU-07 `MapExplorer`를 덮고 방문 증명·출처를 실제보다 강하게 표현한다. 실제 API 호출은 Auth·UUID 계약 없이 추가하면 실패하거나 공개 반영 조건을 오해시킨다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 관련 단위 테스트 | 직접 Node로 `vitest run` | 성공 | 최신 main 병합 후 13개 파일·68개 통과, 외부 통합 2개 미실행; WU-08 전용 7개 통과 |
| 정적 검사 | 직접 Node로 `eslint .`, `tsc --noEmit` | 성공 | 오류 0개 |
| 빌드 | `next build --webpack` | 성공 | 3개 상세 경로 SSG 생성. 기본 Turbopack은 worktree Junction 제약으로 미사용 |
| 수동 AC 검증 | in-app browser, 1440×900·390×844 | 성공 | 가로 overflow 없음, 3버튼, 공개 3명 유지, 새로고침 개인 반응 복원, 0건·영상 없음 상태, 출처 링크 확인 |
| 실패·복구 경로 | 손상 localStorage 단위 테스트, 미등록 ID production 요청 | 성공 | 저장 데이터 복구, 미등록 ID HTTP 404와 홈 복구 링크 |

- 통과한 AC: AC-01~05, AC-15, AC-17~18의 WU-08 UI 범위.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 실제 Auth·`/api/reactions`·위치 체크인은 WU-09·10 범위라 실행하지 않았다. WU-12·14의 live YouTube/Supabase 통합 2개는 명시적 실행 환경변수가 없어 건너뛰었다. 격리 worktree의 표준 `pnpm run build`는 공유 Junction 삭제 위험과 Turbopack 제약 때문에 실행하지 않고 동일 코드의 webpack production build로 대체했다.
- 테스트 데이터 안전 확인: 합성 식당·반응·영상 데이터만 사용했다.
- 비밀값 노출 확인: 없음.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `src/app/restaurants/[id]/page.tsx` | SSG 상세 route·실제 404·공개/개인/방문 안내 구성 |
| `src/components/restaurant-detail/restaurant-detail-view-model.ts` | 반응·매칭·공개 가능 영상 fixture를 동일 계약으로 조합 |
| `src/components/restaurant-detail/reaction-selector.tsx` | 정확히 세 반응의 한 탭 선택과 저장 성공·실패 안내 |
| `src/components/restaurant-detail/private-reaction-store.ts` | 버전된 최소 localStorage schema와 손상 데이터 복구 |
| `src/components/restaurant-detail/detail-match-panel.tsx` | 개인 매칭과 먹지 않는 음식 하드 제외 설명 |
| `src/components/restaurant-detail/creator-evidence-list.tsx` | confirmed·fresh 원본 영상·구독자 원값·API 기준 시각 표시 |
| `src/components/map/map-explorer.tsx` | 카드 선택 계약을 유지하는 상세 이동 링크 |
| `src/app/globals.css` | 상세 화면·390px·1440px 스타일 |
| `tests/restaurant-detail.test.tsx` | 상세 view model·저장·금지 표현·빈 상태 회귀 |
| `README.md`, `docs/DEVELOPMENT_PRIORITY.md`, `docs/development-logs/INDEX.md` | 완료 상태와 WU-09 재개 지점 동기화 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: mock slug와 실제 DB UUID 매핑, access token 공급, 서버 반응 상태를 로컬 개인 취향과 병합하는 규칙을 WU-09 통합에서 확정해야 한다. 격리 worktree에서는 기본 Turbopack이 Junction을 거부하므로 실제 저장소 또는 독립 설치 환경에서 표준 빌드를 다시 확인한다.
- 후속 작업 후보: WU-09 로그인·실제 반응 저장 UI 연결, 이후 WU-10 위치 체크인.
- 사용자 또는 외부 입력이 필요한 사항: WU-09 통합 직전 담당자와 mock slug→DB UUID 매핑 및 겹치는 파일을 확인한다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. WU-09 최신 브랜치와 이 일지의 mock slug·DB UUID·Auth token 미해결 경계를 먼저 대조한다.
2. 실제 사용자 반응 DTO가 준비되면 `ReactionSelector`의 로컬 개인 취향과 서버의 현재 반응을 구분해 연결한다.
3. 방문 증명이 없거나 인증이 만료된 경로는 계속 로컬 개인 취향만 갱신하고 공개 집계 수치를 즉시 바꾸지 않는다.
4. 연결 후 비로그인·일반 사용자·API 401/409/429·재시도·새로고침 회귀를 추가한다.
5. WU-09 완료 후 WU-10 위치 체크인으로 넘어간다.

## 9. 세션 업데이트

### 2026-08-25 — 10분 준비 구간

- 추가 구현: 없음. WU-08 전용 브랜치와 구현 계약 준비.
- 새 문제 또는 막힘: mock slug·API UUID 불일치, Auth token 공급 부재.
- 해결 또는 시도: 실제 저장은 WU-09 통합 경계로 남기고 WU-08은 안전한 UI·상태 안내부터 구현하기로 결정.
- 검증 결과: 최신 원격, WU-09 route·서비스 계약, A1 prototype 비교 완료.
- 현재 재개 지점: Server Component 상세 route와 한 탭 선택 Client Component 구현.

### 2026-08-25 — 구현·검증 완료

- 추가 구현: 세 상세 SSG, 한 탭 로컬 반응, 공개 제외·방문 후속 안내, 개인 매칭·하드 제외, confirmed 영상 근거, 지도 카드 상세 링크.
- 새 문제 또는 막힘: worktree Junction의 pnpm/Turbopack 제약과 `notFound()` 화면의 production 200 응답.
- 해결 또는 시도: 공유 의존성을 보존한 직접 Node 품질 명령·webpack build를 사용하고 `dynamicParams = false`로 미등록 ID를 실제 404로 수정했다.
- 검증 결과: 전체 49개 테스트, lint, typecheck, webpack production build, 390×844·1440×900, 반응 선택·변경·복원, HTTP 404·복구 링크 모두 통과.
- 현재 재개 지점: WU-09 Auth·DB UUID 계약을 확정한 뒤 `ReactionSelector`를 실제 반응 API에 연결한다.

### 2026-08-25 — push 직전 main 통합

- 추가 구현: 없음. 원격 main의 WU-12·WU-14 변경 9개 commit을 현재 브랜치에 병합해 공용 우선순위와 일지 인덱스를 함께 보존했다.
- 새 문제 또는 막힘: 최초 push 안전 검사에서 원격 main의 공용 문서 변경을 감지해 push가 차단됐다.
- 해결 또는 시도: 열린 PR이 WU-09 하나이고 구현 파일이 겹치지 않음을 확인한 뒤 `origin/main`을 일반 merge했다.
- 검증 결과: 병합 후 68개 통과·외부 통합 2개 미실행, lint·typecheck·webpack production build 통과. WU-08·12·14 문서 상태가 모두 유지됐다.
- 현재 재개 지점: 안전 검사를 다시 실행하고 통과할 때만 일반 push한다.
