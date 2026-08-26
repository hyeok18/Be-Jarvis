# [WU-17] 오류·반응형·접근성·보안

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-17 |
| 상태 | 막힘 — 선행 WU와 대상 Supabase 연결 대기 |
| 작업일 | 2026-08-25 |
| 담당 | A2+공통 |
| 대상 AC | AC-24~26 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-15, WU-16 |
| 다음 작업 단위 | WU-15·WU-16 완료와 대상 Supabase 연결 후 WU-17 재개 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 앱의 오류 상태, 390px·1440px 반응형, 키보드 조작, 클라이언트 비밀값 경계와 Supabase 보안 계약을 릴리스 전에 검증한다.
- 세션 범위: 사용자 요청에 따라 최신 `main`에서 지금 확인 가능한 WU-17 사전 회귀와 작은 결함 수정을 먼저 수행한다.
- 완료 조건: WU-15·WU-16 통합 결과까지 포함해 UI 회귀, DB 테스트, Supabase advisor, 비밀값 검사가 모두 통과해야 한다.
- 범위 밖 항목: WU-15 실제 30곳 수직 통합과 WU-16 발표 스냅샷 구현 자체.

## 2. 무엇을 만들었는가

- 로딩·404 화면에 남아 있던 이전 랭킹 제품 문구를 현재 맛집 지도 제품 문구로 교체했다.
- 로딩·404·일반 오류·전역 오류의 문구와 복구 버튼을 고정하는 회귀 테스트를 추가했다.
- 클라이언트 도달 가능 코드에 서버 전용 환경변수 이름이나 secret/service-role 표식이 들어오지 못하게 하는 테스트를 추가했다.
- 모든 앱 테이블의 RLS, 소유권 정책, private `security definer`, 권한 회수, 핵심 인덱스를 migration 전체에서 확인하는 정적 보안 계약 테스트를 추가했다.

사용자 또는 시스템 동작 변화:

- 로딩 화면은 `맛집 지도를 준비하고 있습니다.`, 404 화면은 `맛집 지도 홈으로 돌아가기`로 현재 제품을 일관되게 안내한다.
- 보안 경계가 깨지면 일반 Vitest 품질 게이트에서 바로 실패한다.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: WU-17의 선행 작업인 WU-15와 WU-16이 아직 대기 상태다.
- 막힌 지점: 실제 30곳 데이터·발표 스냅샷을 포함한 최종 화면 상태를 검증할 수 없다.
- 문제: 현재 연결 도구에서 `Be-Jarvis` Supabase 프로젝트를 찾을 수 없고 로컬 Docker도 설치되어 있지 않다.
- 막힌 지점: `pnpm run test:db`, 실제 프로젝트의 security/performance advisor, leaked-password-protection 설정을 재검증할 수 없다.
- 문제: 실행 중인 `next dev`와 production build가 같은 `.next` 캐시를 사용하면서 검증 뒤 Turbopack HMR 캐시 오류가 발생했다.
- 영향: 현재 코드와 migration의 정적 계약은 검증했지만 WU-17을 완료로 표시할 수 없다.

## 4. 어떻게 해결했는가

- 원인: WU-17이 통합·릴리스 게이트라서 아직 만들어지지 않은 선행 결과와 운영 대상 프로젝트가 필요하다.
- 선택한 해결 방법: 최신 `main`으로 이동한 뒤 독립적으로 가능한 UI·fallback·접근성·클라이언트 비밀값·migration 정적 검사를 먼저 완료하고, 외부 재개 조건은 명시적으로 남겼다.
- 다른 선택지를 쓰지 않은 이유: 연결된 다른 Supabase 프로젝트는 이 저장소 schema가 없는 별도 프로젝트라서 변경하거나 그 결과를 WU-17 증거로 사용할 수 없다.
- 개발 서버는 production build 완료 뒤 종료·재시작해 새 Turbopack 캐시로 localhost 200 응답을 복구했다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 관련 단위 테스트 | `pnpm test` | 성공 | 앱 상태·클라이언트 비밀값·Supabase 정적 계약 포함 36/36 |
| 정적 검사 | `pnpm run check:env`, `pnpm run lint`, `pnpm run typecheck` | 성공 | 환경 계약 7키, lint·타입 오류 0 |
| 빌드 | `pnpm run build` | 성공 | 정상 Kakao 키 production artifact |
| 반응형 | 브라우저 390x844, 1440x1000 | 성공 | 가로 overflow 없음, 모바일 1열·데스크톱 2열 |
| 키보드 접근성 | `Tab`, `Enter` | 성공 | 필터·크리에이터·지도 토글·카드 조작 확인 |
| Kakao 실패·복구 | 빈 public 지도 키 production build | 성공 | 두 viewport에서 주소·반응·Kakao·YouTube 링크 보존, 오류 overlay 없음 |
| DB 테스트 | `pnpm run test:db` | 미실행 | `127.0.0.1:54322` 연결 불가, Docker 명령 없음 |
| 원격 보안 검증 | Supabase advisor·Auth 설정 | 미실행 | 대상 `Be-Jarvis` 프로젝트가 현재 연결 목록에 없음 |

- 통과한 AC: AC-24·AC-25의 현재 셸 범위와 AC-26의 클라이언트·migration 정적 범위.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: WU-15·WU-16 통합 화면 회귀, 대상 Supabase DB 테스트·advisor·Auth 설정은 선행 결과와 프로젝트 연결이 필요하다.
- 테스트 데이터 안전 확인: 앱 fixture와 migration 파일만 읽었고 연결된 다른 Supabase 프로젝트는 변경하지 않았다.
- 비밀값 노출 확인: 클라이언트 코드·production static bundle에서 서버 전용 환경변수 이름과 secret/service-role 표식이 발견되지 않았다. `.env.local` 값은 출력·추적하지 않았다.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `src/app/loading.tsx` | 현재 제품 로딩 문구로 정정 |
| `src/app/not-found.tsx` | 현재 제품 홈 링크 문구로 정정 |
| `tests/app-state-copy.test.ts` | 오류·복구 상태 문구 회귀 방지 |
| `tests/client-security-boundary.test.ts` | 클라이언트 비밀값 경계 회귀 방지 |
| `tests/supabase-security-contract.test.ts` | migration RLS·권한·함수·인덱스 계약 고정 |
| `docs/DEVELOPMENT_PRIORITY.md` | WU-17 실제 상태와 재개 조건 반영 |
| `docs/development-logs/INDEX.md` | WU-17 일지 연결 |
| `docs/development-logs/2026-08-25_WU-17_quality-security.md` | 사전 검증·막힘·인계 기록 |

보호 대상인 `supabase/seed.sql`, `supabase/migrations`, DB 타입, package 파일은 수정하지 않았다.

## 7. 남은 위험과 미해결 항목

- 남은 위험: WU-15·WU-16 통합 뒤 DOM·번들·접근성 상태가 달라질 수 있다.
- 후속 작업 후보: 실제 쿼리 사용량이 생긴 뒤 performance advisor의 unused-index 알림을 재평가한다.
- 사용자 또는 외부 입력이 필요한 사항: 대상 `Be-Jarvis` Supabase 프로젝트 연결 권한 또는 로컬 Docker 환경, 그리고 WU-15·WU-16 완료가 필요하다.
- 기존 WU-03/WU-05 기록의 leaked password protection 비활성화 경고는 대상 프로젝트에서 활성화하고 다시 확인해야 한다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. WU-15와 WU-16을 완료하고 실제 30곳·스냅샷 상태로 390px·1440px 및 키보드 회귀를 다시 실행한다.
2. 대상 Supabase 프로젝트를 연결해 pgTAP 또는 `pnpm run test:db`, security advisor, performance advisor, Auth leaked-password-protection을 확인한다.
3. 전체 `check:env`·lint·typecheck·test·build와 push 안전 검사를 통과한 뒤에만 WU-17을 완료로 바꾼다.

## 9. 세션 업데이트

### 2026-08-25 — 사전 품질·보안 회귀

- 추가 구현: 제품 상태 문구 수정, 앱 상태·클라이언트 비밀값·Supabase 정적 보안 계약 테스트.
- 새 문제 또는 막힘: WU-15·WU-16 미완료, 대상 Supabase 프로젝트 미연결, 로컬 Docker 부재.
- 해결 또는 시도: 최신 `main` 기반 UI·접근성·fallback·정적 보안 검증을 완료하고 별도 프로젝트는 건드리지 않았다.
- 검증 결과: exact 390px·1440px, 키보드, 빈 Kakao 키 fallback, 36개 Vitest, lint·typecheck·production build 통과. 개발 서버도 깨끗하게 재시작해 localhost 200을 확인했다. DB·advisor는 재개 조건으로 남았다.
- 현재 재개 지점: WU-15·WU-16 완료와 대상 Supabase 연결 후 통합 회귀 실행.

### 2026-08-26 — 발표용 터치 영역·줄바꿈 보완

- 추가 구현: 카테고리 필터, 식당 선택 카드, 크리에이터 영상 근거 링크, 지도 fallback 식당 선택·외부 링크의 최소 높이를 44px(`2.75rem`) 이상으로 통일했다. 길어진 제목·주소·영상 제목·fallback 문구에는 `overflow-wrap: anywhere`를 적용했다.
- 범위 준수: `src/app/globals.css`만 수정했으며 Production, Deployment Protection, Supabase·YouTube 설정, API, 위치 체크인 흐름은 변경하지 않았다.
- 정적 확인: `git diff --check` 통과. 클라이언트 코드에서 실제 비밀값은 확인되지 않았고, 서버 환경변수 이름은 `src/lib/env-contract.ts`와 테스트에만 존재함을 확인했다.
- 미실행: `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, `pnpm run build`는 OneDrive 상위 경로 `stat` 권한 오류(`EPERM`)로 시작하지 못했다. Preview는 Deployment Protection 접근 권한이 없어 390x844·1440x900 시각 검증, Tab/Enter 흐름, 앱 도메인 콘솔 검증을 수행하지 못했다.
- 현재 재개 지점: 접근 가능한 Preview 또는 로컬 의존성 환경에서 네 품질 명령과 두 viewport·키보드 회귀를 실행한다. 결과가 모두 통과하기 전 WU-17 상태는 `막힘`으로 유지한다.
