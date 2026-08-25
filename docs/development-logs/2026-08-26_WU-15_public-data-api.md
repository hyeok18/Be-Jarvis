# [WU-15] 30곳 실제 수직 통합 — 공개 데이터·API

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-15 |
| 상태 | 진행 중 |
| 작업일 | 2026-08-26 |
| 담당 | 데이터·API |
| 대상 AC | AC-01~24 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-07, WU-11, WU-13 |
| 다음 작업 단위 | A의 지도·목록·상세 실제 DTO 연결과 WU-15 통합 회귀 |

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
- A는 성공 응답만 렌더링하고 503에서는 빈 배열·0점으로 대체하지 않아야 한다. `PUBLIC_DATA_UNAVAILABLE` 오류 상태를 명시적으로 보여야 한다.
- 개인 취향 선택·하드 제외는 기존 로컬 P0 계약을 계속 사용하고 `reactionSummary`에 합산하지 않는다.
- 통합 직전 A의 활성 브랜치와 공용 문서 충돌을 다시 확인하고, 완료 게이트가 모두 통과한 뒤에만 INDEX와 개발 우선순위를 `완료`로 갱신한다.

## 7. 세션 업데이트

### 2026-08-26 — 데이터·API 담당

- 추가 구현: 실제 30곳 목록·상세 DTO, counted-only summary, 공개 creator evidence, 명시적 503/404 계약, 단위·원격 DB 테스트.
- 새 문제 또는 막힘: 연결된 Supabase 도구에는 팀 프로젝트가 보이지 않았고 로컬 Docker가 없었다.
- 해결 또는 시도: 로그인된 Supabase Dashboard에서 정확한 Be-jarvis 프로젝트를 확인하고, SQL Editor의 `BEGIN ... ROLLBACK`으로 pgTAP 12개를 실행했다.
- 검증 결과: pgTAP 12/12, Vitest 133개, lint·typecheck·build, security/performance advisor 통과.
- 현재 재개 지점: 데이터·API 브랜치 전달 후 A의 화면 연결과 WU-15 전체 통합 회귀. 전체 완료 전까지 상태는 `진행 중`이다.
