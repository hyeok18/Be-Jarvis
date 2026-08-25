# A3 인계서 — WU-06, WU-08

| 항목 | 내용 |
|---|---|
| 인계일 | 2026-08-25 |
| 이전 담당 | A1 |
| 인수 담당 | A3 |
| 대상 | WU-06 완료 후 WU-08 착수 |
| 기준 브랜치 | `main` 최신 상태 |

## 먼저 확인할 사항

원격 `main`에는 WU-03~05와 WU-07의 후속 코드가 이미 반영되어 있다. WU-06은 보드상 아직 `다음` 상태이므로, A3는 이 기준 브랜치에서 구현을 시작한다. 이전 A1의 로컬 UI 파일을 그대로 덮어쓰지 말고 현재 지도 컴포넌트의 계약을 보존한다.

먼저 아래 파일과 기호를 확인한다.

- `src/app/page.tsx` — `MapExplorer`
- `src/components/map/map-explorer.tsx` — `MapExplorer`
- `src/components/map/map-view-model.ts` — 지도·목록용 view model
- `src/domain/signals.ts` — `summarizeRestaurantReactions`, 공개 집계 경계
- `docs/development-logs/2026-08-25_WU-05_reaction-engine.md` — counted-only summary와 실패 복구 계약

GitHub 코드 검색어: `MapExplorer`, `summarizeRestaurantReactions`, `counted`, `creatorVisitSources`, `restaurant-card`.

## WU-06 — 공개 지도 셸과 mock 반응·매칭 UI

### 목표

- 별점·평균·종합점수 없이 `좋아요`, `그냥 그래요`, `싫어요` 세 반응을 보여 준다.
- 반응 0건과 10건 미만 상태를 구분한다.
- 공개 반응과 개인 매칭을 분리하고, 제외 음식은 개인 매칭에서 명시적으로 제외한다.
- WU-07의 지도·카테고리·크리에이터 레이어·fallback 계약을 훼손하지 않는다.

### 완료 전 검증

1. 390×844와 1440×900에서 탭, 카드 선택, 빈 상태, 가로 overflow를 확인한다.
2. `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, `pnpm run build`를 실행한다.
3. 개발일지를 새로 만들고 보드와 `INDEX.md`에서 WU-06을 `완료`로 변경한다.

## WU-08 — 식당 상세·한 탭 반응·개별 영상 근거 UI

WU-06이 완료된 뒤에만 시작한다.

- 구현 범위: 식당 상세, 세 반응 한 탭 UI, 체크인 공개 반영 안내, `confirmed` YouTube 영상 근거
- 표시 규칙: 별점·평균·종합점수 금지; 확인된 영상만 공개; 구독자 수는 최신 API 원값만 표시; 출처·원본 링크·메타데이터 기준 시각 표시
- 범위 밖: 실제 Auth·반응 저장은 WU-09, 위치 체크인은 WU-10
- 후속 의존성: WU-09는 WU-03과 WU-08 모두 완료돼야 UI 연결을 마칠 수 있다.

## 병렬 작업 주의

`src/app/page.tsx`, 전역 스타일, 지도 view model은 충돌 가능성이 높다. 수정 전 관련 담당자에게 알리고, 하나의 세션에서는 WU-06 또는 WU-08 하나만 활성화한다.
