# [WU-13] 크리에이터 후보 확인·sync log 관리자 UI

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-13 |
| 상태 | 진행 중 |
| 작업일 | 2026-08-25 |
| 담당 | B2 |
| 대상 AC | AC-15, AC-19 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-08, WU-12 |
| 다음 작업 단위 | 관리자 app metadata 설정과 실제 후보 1건 검증 후 WU-15 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 자동 감지한 영상·식당 후보를 관리자 확인 전에는 숨기고, 확인 담당자가 원본 영상과 Kakao 장소를 비교해 확정 또는 거절할 수 있게 한다.
- 세션 범위: 관리자 로그인·권한 검증, 후보·상태·동기화 기록 조회, 확정·거절, 수동 YouTube 동기화, 반응형 관리자 UI, 자동·브라우저 검증.
- 완료 조건: `app_metadata` 관리자만 접근, candidate 비공개 유지, 활성 public 영상만 확정, stale·삭제 상태 표시, sync log와 수동 실행, 실제 관리자 계정·DB 후보 1건 검증.
- 범위 밖 항목: 새 DB migration, 공개 사용자 화면의 실제 DB 연결, Vercel Production 환경변수·배포.

## 2. 무엇을 만들었는가

- Supabase 비밀번호 로그인을 서버 route에서 처리하고 access token을 최대 1시간짜리 `HttpOnly`, `SameSite=Strict`, HTTPS `Secure` 쿠키에만 저장한다.
- 관리자 판단은 사용자가 수정할 수 있는 `user_metadata`를 무시하고 `app_metadata.role=admin` 또는 `app_metadata.is_admin=true`만 허용한다.
- 관리자 GET·POST route는 매번 Supabase `/auth/v1/user`로 토큰을 다시 검증한다. 변경 route와 로그인 route는 same-origin 요청만 허용한다.
- 후보 목록은 영상 제목·채널·공개 상태·원본 YouTube URL과 식당 주소·Kakao place ID를 한 DTO로 제공한다.
- 확정은 현재 상태가 `candidate`이고 영상이 active/public이며 식당이 active일 때만 가능하다. DB PATCH에도 `status=eq.candidate`를 넣어 동시 처리 덮어쓰기를 막는다.
- 거절, 읽기 전용 confirmed/rejected/stale 상태, WU-12 공유 진입점의 수동 동기화, 최근 sync run 조회를 구현했다.
- `/admin`에서 로그인, 운영 요약, 후보 확정·거절 메모와 영상 시간, allowlist 5개 채널, 최근 동기화 기록을 확인할 수 있다.
- 클라이언트 DTO를 별도 계약 파일로 분리해 브라우저 코드가 `SUPABASE_SECRET_KEY`를 참조하는 서버 모듈에 도달하지 않게 했다.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: 프로젝트의 pnpm 실행기가 기존 `node_modules`를 재설치하려다 비대화형 터미널에서 중단됐다.
- 해결: package·lockfile·설치 디렉터리를 바꾸지 않고 기존 `node_modules/.bin` 실행 파일로 테스트·타입·lint·빌드를 검증했다.
- 문제: 첫 전체 테스트에서 클라이언트가 서버 저장소의 타입을 직접 import해 정적 비밀키 경계 검사가 실패했다.
- 해결: 화면 DTO를 `src/contracts/creator-admin.ts`로 분리하고 클라이언트→서버 저장소 의존을 제거했다.
- 남은 막힘: 대상 Supabase Auth에는 아직 `app_metadata` 관리자 사용자가 없다. 권한 부여는 실제 계정 권한을 바꾸는 작업이므로 사용자 확인 없이 실행하지 않았다.

## 4. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| WU-13 단위 테스트 | 관리자 auth·session·repository·API 테스트 | 성공 | 신규 19개 경로 통과 |
| 전체 자동 테스트 | `vitest run` | 성공 | 17개 파일 87개 통과, 외부 live 전용 2개 skip |
| 환경 계약 | `node scripts/check-env-contract.mjs` | 성공 | 7개 변수 이름 선언, 값 미출력 |
| 정적 검사 | `eslint`, `tsc --noEmit` | 성공 | 오류·경고 0개 |
| 클라이언트 보안 경계 | `client-security-boundary.test.ts` | 성공 | server-only key 참조 없음 |
| 배포용 빌드 | `next build` | 성공 | `/admin`과 관리자 API route 생성 |
| 데스크톱 브라우저 | 로컬 `/admin`, `/` | 성공 | 내용·입력·버튼 표시, 오류 overlay·console 오류 없음 |
| 모바일 브라우저 | 390×844 | 성공 | 가로 넘침 없음, 로그인 폼 정상 표시 |
| 실제 관리자·DB 변경 | 미실행 | 대기 | 관리자 app metadata 부여와 후보 1건 상태 변경에 사용자 승인 필요 |

- 통과한 AC: AC-15 관리자 후보 비교·원본 영상 경로의 코드/UI 경계, AC-19 candidate 비공개·확정 조건·stale 표시의 자동 검증.
- 최종 완료 전 남은 검증: 실제 관리자 로그인, 후보·sync log 실조회, 합성 후보 1건 확정 또는 거절, 공개 화면에 candidate가 나오지 않고 confirmed만 나오는지 재확인.
- 비밀값 노출 확인: 없음. 환경변수 값, access token, 비밀번호, 프로젝트 식별값을 출력·저장소 기록하지 않았다.

## 5. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `src/contracts/creator-admin.ts` | 브라우저에서 안전한 관리자 DTO 계약 |
| `src/server/admin/admin-auth.ts` | Supabase 로그인·`app_metadata` 권한 검증 |
| `src/server/admin/admin-session.ts` | 보안 쿠키·입력·same-origin 경계 |
| `src/server/admin/creator-admin-api.ts` | 후보·sync·결정 route 공통 처리 |
| `src/server/admin/configured-creator-admin.ts` | WU-12 sync와 관리자 저장소 조립 |
| `src/server/youtube/creator-admin-repository.ts` | server-only 후보·sync run 조회와 확정·거절 |
| `src/app/api/admin/**` | session, 후보, confirm/reject, manual sync, sync log route |
| `src/app/admin/page.tsx` | 관리자 화면 route와 allowlist 전달 |
| `src/components/admin/admin-dashboard.tsx` | 로그인·후보·채널·sync log 운영 UI |
| `src/components/admin/admin-dashboard.module.css` | 관리자 전용 반응형·접근성 스타일 |
| `tests/admin-*.test.ts`, `tests/creator-admin-*.test.ts` | 인증·쿠키·권한·상태 전이·API 보안 테스트 |

## 6. 남은 위험과 재개 지점

- 현재 코드와 UI는 완료됐지만 실제 관리자 계정 권한과 DB 상태 변경 검증 전이므로 WU-13 상태를 `진행 중`으로 유지한다.
- 사용자가 권한 부여를 승인하면 대상 Auth 사용자의 `raw_app_meta_data`에 관리자 역할을 서버 관리 경로로 설정한다. `raw_user_meta_data`는 사용하지 않는다.
- 로그인 성공 뒤 현재 합성 `candidate` 한 건의 원본 영상·식당을 확인하고, 사용자가 선택한 확정 또는 거절을 1회 실행한다.
- 실제 변경 후 `creator_visit_evidence` 상태·confirmed 필드와 공개 화면 경계를 확인한다. 완료되면 보드와 인덱스를 `완료`로 바꾼다.
- WU-15 통합 전 공개 화면은 DB의 confirmed·fresh evidence만 읽도록 유지해야 하며 관리자 API DTO를 재사용해 공개하면 안 된다.

## 7. 세션 업데이트

### 2026-08-25

- 추가 구현: 관리자 로그인·쿠키, app metadata 검증, 후보·결정·sync API, `/admin` 반응형 운영 화면.
- 충돌 회피: migration, package, lockfile, DB 생성 타입, 전역 CSS를 수정하지 않고 신규 전용 파일 중심으로 작업했다.
- 검증 결과: 전체 87개 테스트, lint, typecheck, production build, 데스크톱·390px 브라우저 검증 통과.
- 현재 재개 지점: 사용자 승인 후 관리자 app metadata 설정 → 실제 로그인 → 합성 후보 1건 처리 → 공개 경계 확인 → WU-13 완료 처리.
