# [WU-08] 식당 상세·한 탭 반응·개별 영상 근거 UI

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-08 |
| 상태 | 진행 중 |
| 작업일 | 2026-08-25 |
| 담당 | A3 (A1 인계) |
| 대상 AC | AC-01~05, AC-15, AC-17~18 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md), [WU-06 일지](./2026-08-25_WU-06_public-map-mock-ui.md) |
| 선행 작업 | WU-06 완료 |
| 다음 작업 단위 | WU-09 UI 연결 완료 또는 WU-10 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 지도에서 선택한 식당의 세 반응, 개인 매칭, 확인된 영상 근거와 방문 증명 상태를 상세 화면에서 오해 없이 확인하고 반응을 한 번에 선택할 수 있어야 한다.
- 세션 범위: 동적 상세 route, 세 반응 한 탭 선택 UI, 공개·개인 저장 조건 안내, confirmed 영상 근거, 지도 카드의 상세 이동.
- 완료 조건: 금지 점수 없이 390×844·1440×900, 키보드, 404, 반응 선택·변경, 영상 원본 링크와 전체 품질 게이트를 통과한다.
- 범위 밖 항목: Supabase Auth 화면·실제 access token 발급(WU-09), 실제 위치 proof(WU-10), rate limit(WU-11).

## 2. 무엇을 만들었는가

- 구현 또는 문서화한 내용: WU-09 HTTP 계약과 A1 prototype commit `53f0775`를 비교해 이식 경계와 위험을 확정했다.
- 사용자 또는 시스템 동작 변화: 아직 없음. 다음 세션에서 구현한다.

변경한 파일:

- `docs/DEVELOPMENT_PRIORITY.md`
- `docs/development-logs/INDEX.md`
- `docs/development-logs/2026-08-25_WU-08_restaurant-detail-reaction-ui.md`

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: A1 prototype은 클라이언트 토글만으로 방문 확인 완료를 표현하고, 합성 구독자 라벨·YouTube 홈 링크·영업시간·거리 같은 미확인 정보를 표시한다.
- 막힌 지점: 실제 `/api/reactions`는 UUID 식당 ID와 bearer token을 요구하지만 WU-06 fixture ID는 slug이고 Auth client가 아직 없다.
- 영향: prototype 전체 merge와 실제 저장 호출은 하지 않는다. UI 계약과 실제 저장 계약을 명시적으로 분리한다.

## 4. 어떻게 해결했는가

- 원인: A1 prototype이 WU-06·08 시각 흐름을 한 client page에 섞었고 WU-09·10 서버 경계보다 먼저 작성됐다.
- 선택한 해결 방법: 상세 `page.tsx`는 async `params`를 받는 Server Component와 `generateStaticParams`·`notFound()`로 만들고, 한 탭 선택만 작은 Client Component로 분리한다. 영상은 WU-06과 동일한 confirmed·fresh fixture 원값만 전달한다.
- 다른 선택지를 쓰지 않은 이유: prototype을 통째로 병합하면 WU-07 `MapExplorer`를 덮고 방문 증명·출처를 실제보다 강하게 표현한다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 관련 단위 테스트 | 미실행 | 미실행 | 구현 전 준비 세션 |
| 정적 검사 | 미실행 | 미실행 | 문서만 변경 |
| 빌드 | 미실행 | 미실행 | 구현 후 실행 |
| 수동 AC 검증 | 390×844, 1440×900 | 미실행 | 구현 후 실행 |
| 실패·복구 경로 | 잘못된 식당 ID·비로그인·저장 실패 | 미실행 | 구현 후 실행 |

- 통과한 AC: 없음. 구현 전이다.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 사용자가 요청한 10분 준비 구간이므로 코드 구현은 다음 세션으로 미뤘다.
- 테스트 데이터 안전 확인: 합성 데이터만 검토했다.
- 비밀값 노출 확인: 없음.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `docs/DEVELOPMENT_PRIORITY.md` | WU-08 착수 상태 기록 |
| `docs/development-logs/INDEX.md` | WU-08 최신 재개 기록 연결 |
| `docs/development-logs/2026-08-25_WU-08_restaurant-detail-reaction-ui.md` | 계약 점검과 정확한 다음 구현 순서 기록 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: mock slug와 실제 DB UUID 매핑, access token 공급, WU-09 활성 브랜치와 API 연결 책임을 후속 통합에서 확정해야 한다.
- 후속 작업 후보: WU-09 로그인·실제 반응 저장 UI 연결.
- 사용자 또는 외부 입력이 필요한 사항: 없음. 로컬 mock UI부터 구현 가능하다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. `src/app/restaurants/[id]/page.tsx` Server Component와 `generateStaticParams`·`notFound()`를 구현한다.
2. 직렬화된 식당·summary·match·confirmed 영상 props만 받는 `ReactionSelector` Client Component를 구현한다.
3. WU-06 식당 카드에서 상세 route로 이동시키되 카드↔마커 선택 계약은 보존한다.
4. 실제 체크인을 흉내 내는 토글을 만들지 말고, 증명 없음은 개인 취향 전용이라는 안내와 WU-10 예정 상태를 표시한다.
5. 자동 테스트와 두 viewport·404·반응 변경·영상 링크 검증 후에만 완료 처리한다.

## 9. 세션 업데이트

### 2026-08-25 — 10분 준비 구간

- 추가 구현: 없음. WU-08 전용 브랜치와 구현 계약 준비.
- 새 문제 또는 막힘: mock slug·API UUID 불일치, Auth token 공급 부재.
- 해결 또는 시도: 실제 저장은 WU-09 통합 경계로 남기고 WU-08은 안전한 UI·상태 안내부터 구현하기로 결정.
- 검증 결과: 최신 원격, WU-09 route·서비스 계약, A1 prototype 비교 완료.
- 현재 재개 지점: Server Component 상세 route와 한 탭 선택 Client Component 구현.
