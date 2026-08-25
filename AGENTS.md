# Repository Guidance

이 규칙은 저장소 전체에 적용한다. 사용자의 현재 명시적 지시가 이 문서보다 우선한다.

## 1. 기준 문서와 판단 순서

새 작업을 시작하기 전에 다음 문서를 순서대로 읽는다.

1. `AGENTS.md`
2. `PRD.md`
3. `docs/DEVELOPMENT_PRIORITY.md`
4. `docs/development-logs/INDEX.md`
5. 현재 작업 단위의 최신 개발일지
6. `docs/TEAM_GIT_GUIDE.md`
7. `README.md`
8. `docs/PROJECT_CONCEPT.md`

요구사항이 충돌하면 다음 순서로 판단한다.

```text
사용자의 현재 명시적 지시
→ PRD.md
→ DEVELOPMENT_PRIORITY.md
→ 현재 작업 단위의 최신 개발일지
→ TEAM_GIT_GUIDE.md
→ README.md
→ PROJECT_CONCEPT.md
→ 기존 코드
```

외부 API, SDK, 배포 플랫폼, 보안 설정처럼 변경 가능성이 있는 정보는 현재 공식 문서를 확인한다. 확인하지 못한 동작을 추측해 구현 계약으로 만들지 않는다.

## 2. 세션 시작 절차

모든 새 작업 세션은 아래 순서로 시작한다.

1. `git status`로 기존 변경을 확인하고 다른 사람의 작업을 보존한다.
2. 위 기준 문서를 순서대로 읽는다.
3. `DEVELOPMENT_PRIORITY.md`와 `development-logs/INDEX.md`에서 현재 세션이 맡을 작업 단위를 찾는다.
4. 동일 담당 범위에 `진행 중` 또는 `막힘` 작업이 있으면 새 단위를 시작하지 않고 해당 작업의 최신 일지를 읽어 이어서 진행한다.
5. 진행 중 작업이 없으면 선행 조건이 완료된 가장 높은 우선순위의 `다음` 작업 하나만 선택한다.
6. 최신 일지의 `다음 작업에서는 어떻게 해야 하는가`, 미해결 문제, 실패한 테스트를 먼저 확인한다.
7. 구현 전에 이번 세션의 작업 단위 ID, 범위, 수정 예상 파일, 완료 조건을 사용자에게 짧게 알린다.

이전 세션에서 테스트가 실패했거나 작업이 미완료라면 그 원인을 해결하기 전에는 후속 작업 단위로 넘어가지 않는다.

## 3. 작업 단위 운영 규칙

- 작업 단위 ID는 `docs/DEVELOPMENT_PRIORITY.md`의 `WU-XX`를 사용한다.
- 한 Codex 세션에서는 작업 단위 하나만 구현한다.
- 한 작업 단위는 한 가지 검증 가능한 결과로 설명할 수 있어야 한다.
- 현재 단위의 선행 조건, 산출물, 대상 AC, 자동 테스트, 수동 검증, 완료 조건을 확인한 뒤 수정한다.
- 범위 밖 개선점은 즉시 구현하지 않고 개발일지의 `남은 위험과 미해결 항목`에 기록한다.
- 필수 P0 작업과 발표 흐름을 완료하기 전에는 PRD의 선택 범위를 시작하지 않는다.
- 팀원이 서로 다른 작업 단위를 병렬 진행할 수는 있지만, 각 세션은 하나만 활성화하며 공유 파일 담당을 먼저 정한다.
- `package.json`, lockfile, DB migration, 공통 타입, 전역 스타일처럼 충돌 가능성이 큰 파일은 동시에 수정하지 않는다.
- 사용자에게 보이는 요구사항은 PRD의 AC ID와 연결하고 재현 가능한 검증 절차를 둔다.
- 작업 상태는 `대기`, `다음`, `진행 중`, `막힘`, `완료` 중 하나만 사용한다.

## 4. 완료 게이트

작업 단위는 다음 조건을 모두 만족해야 `완료`다.

1. 정의된 구현 산출물이 실제로 존재한다.
2. 해당 작업 단위에 연결된 PRD 수용 기준을 재현 가능한 방식으로 검증했다.
3. 변경 위험에 맞는 자동 테스트가 통과했다.
4. 자동화하기 어려운 UI, 접근성, 보안, 배포 조건은 수동 검증 결과가 있다.
5. 정상 경로뿐 아니라 실패 경로와 복구 경로를 확인했다.
6. 원본 리뷰와 파생 결과의 분리, 중립적 표현, 비밀값 비노출 조건을 지켰다.
7. `docs/DEVELOPMENT_PRIORITY.md`의 상태와 완료 증거를 갱신했다.
8. 개발일지와 `docs/development-logs/INDEX.md`를 갱신했다.

테스트를 실행하지 않았거나 실패했다면 완료로 표시하지 않는다. 실행하지 못한 테스트는 `미실행`과 이유를 개발일지에 적고 상태를 `진행 중` 또는 `막힘`으로 유지한다. “작동할 것 같다”는 완료 증거가 아니다.

프로젝트가 제공하는 시점부터 아래 명령을 기본 품질 게이트로 사용한다.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

모든 단위에서 네 명령을 무조건 실행할 필요는 없지만, 생략한 명령과 이유를 일지에 기록한다. 릴리스 게이트에서는 네 명령을 모두 실행한다.

## 5. 개발일지 자동 작성 규칙

Codex는 사용자가 별도로 요청하지 않아도 작업 단위를 구현하거나 세션을 종료할 때 개발일지를 작성 또는 갱신한다.

### 저장 위치와 파일명

모든 개발일지는 아래 폴더에 Markdown으로 저장한다.

```text
docs/development-logs/
```

파일명은 다음 형식을 사용한다.

```text
YYYY-MM-DD_WU-XX_short-slug.md
```

같은 작업 단위가 여러 세션에 걸리면 기존 파일의 `세션 업데이트`에 날짜순으로 내용을 추가한다. 이미 완료한 단위의 독립적인 회귀 수정은 새 일지를 만들고 기존 기록과 서로 연결한다.

### 작성 시점

- 구현과 테스트가 완료되어 작업 단위를 `완료`로 바꾸기 직전
- 세션이 끝나지만 작업 단위가 미완료인 경우
- 사용자 입력, 외부 권한, API 접근, 환경 문제로 멈춘 경우
- 문서, 데이터 스키마, 배포 설정처럼 코드가 아닌 작업 단위를 완료한 경우

### 필수 내용

`docs/DEVELOPMENT_LOG_TEMPLATE.md` 형식을 사용해 아래 질문에 구체적으로 답한다.

- 무엇을 만들었는가?
- 무엇이 문제였고 어디에서 막혔는가?
- 문제를 어떻게 해결했는가?
- 어떤 테스트와 검증을 실행했고 결과는 무엇인가?
- 어떤 파일이 변경됐는가?
- 남은 위험이나 미해결 항목은 무엇인가?
- 다음 작업에서는 무엇을 먼저 해야 하는가?

문제가 없었던 항목도 생략하지 말고 `없음`이라고 적는다. 명령어, 테스트 수, 성공·실패 결과, 수동 검증 환경은 가능한 한 정확히 남긴다. 비밀키, 인증 토큰, 관리자 비밀번호, 실제 개인정보, 원본 API 응답 전체는 일지에 기록하지 않는다.

### 인덱스 동기화

일지를 만들거나 갱신할 때 `docs/development-logs/INDEX.md`에 다음을 함께 반영한다.

- 작업 단위 ID와 제목
- 담당 또는 작업 영역
- 상태
- 최신 기록 날짜
- 개발일지 링크
- 다음 작업 단위 또는 정확한 재개 지점

문서의 상태와 실제 코드 또는 테스트 결과가 다르면 완료 상태를 낮추고 차이를 일지에 적는다.

## 6. 세션 종료와 다음 세션 인계

한 작업 단위가 구현·테스트·검증을 통과하면 다음 순서를 지킨다.

1. 관련 코드, 문서, 테스트 결과를 정리한다.
2. 개발일지를 작성 또는 갱신한다.
3. `development-logs/INDEX.md`를 갱신한다.
4. `DEVELOPMENT_PRIORITY.md`에서 현재 단위를 `완료`로 표시하고 완료 증거를 남긴다.
5. 선행 조건을 모두 만족한 후속 단위 하나를 `다음`으로 표시한다.
6. 사용자에게 완료 내용, 검증 결과, 남은 위험, 다음 작업 단위 ID를 보고한다.
7. 사용자가 여러 작업 단위를 계속 진행하라고 명시하지 않았다면 다음 단위 구현은 시작하지 않고 세션을 종료한다.

다음 세션은 최신 개발일지를 읽고 `다음 작업에서는 어떻게 해야 하는가`의 첫 번째 미완료 항목부터 시작한다. 이전 결정을 다시 추측하거나 완료된 작업을 처음부터 반복하지 않는다.

## 7. 제품 안전·품질 불변 조건

- PRD의 필수 범위가 선택 범위보다 항상 우선한다.
- 합성 리뷰만 사용하며 외부 서비스의 실제 리뷰를 수집하거나 재게시하지 않는다.
- 하나의 통계·언어 신호만으로 리뷰를 광고, 허위, 조작, 사기라고 단정하지 않는다.
- 원본 리뷰 데이터는 파생 점수와 분리하고 분석 과정에서 수정하거나 삭제하지 않는다.
- 모든 파생 결과는 `analysis_run_id`와 `algorithm_version`으로 재현 가능해야 한다.
- 실패한 분석은 마지막 정상 공개 결과를 덮어쓰지 않는다.
- 점수 조정 근거를 사용자 화면에서 설명할 수 있어야 한다.
- 서버 전용 키와 `.env*`, 토큰, 관리자 정보는 커밋하거나 브라우저 번들·로그·개발일지에 노출하지 않는다.
- 관련 없는 기존 변경을 삭제하거나 되돌리지 않는다.
- `git reset --hard`, 강제 push 등 다른 팀원의 작업을 잃을 수 있는 복구 방법을 사용하지 않는다.

## 8. 문서 동기화

변경 내용에 따라 다음 문서를 함께 갱신한다.

- 제품 범위·수용 기준·점수 계약: `PRD.md`
- 작업 순서·의존성·상태·완료 증거: `docs/DEVELOPMENT_PRIORITY.md`
- 실제 구현 과정·문제·테스트·인계: `docs/development-logs/`
- 팀 Git·PR·배포 협업 방식: `docs/TEAM_GIT_GUIDE.md`
- 새 팀원이 처음 볼 프로젝트 상태: `README.md`

PRD를 변경해야 하는 발견이 생기면 현재 작업 단위에서 임의로 범위를 넓히지 않는다. 개발일지에 근거와 영향을 남기고 사용자 또는 팀의 명시적 결정을 받은 뒤 관련 문서를 함께 수정한다.

## 9. Supabase·Vercel 플러그인 실행 규칙

Supabase 또는 Vercel이 관련된 작업은 해당 플러그인과 저장소의 설치된 skill 지침을 먼저 읽고 사용한다. 플러그인은 개발·배포 제어 도구이며 애플리케이션 런타임 의존성으로 만들지 않는다.

### 공통 사전 점검

1. 해당 WU의 선행 조건과 PRD 8장의 인프라 실행 계약을 확인한다.
2. 플러그인으로 기존 조직·팀·프로젝트를 읽기 전용 조회한다.
3. 저장소와 이름 또는 목적이 일치하지 않는 기존 프로젝트를 임의로 재사용하지 않는다.
4. 프로젝트·branch 생성처럼 비용이 생길 수 있는 작업은 조직, 리전, 예상 비용을 확인하고 사용자 동의를 받은 뒤 실행한다.
5. 키, 토큰, 비밀번호, connection string은 채팅·터미널 요약·개발일지·Git diff에 출력하지 않는다.
6. 외부 상태를 바꾸기 전에 정확한 대상 프로젝트와 환경을 다시 확인한다.

### Supabase

- 작업 시작 시 Supabase changelog의 관련 breaking change와 현재 공식 문서를 확인한다.
- schema의 단일 진실원본은 `supabase/migrations/`이며 Dashboard의 기록 없는 즉석 DDL을 최종 상태로 남기지 않는다.
- WU-03 전에는 Production project에 DDL, seed, RLS 변경을 적용하지 않는다.
- 모든 application table에 RLS를 활성화하고 Data API 자동 노출을 전제로 하지 않는다.
- `anon`, `authenticated` 권한은 명시적으로 최소화한다. RLS와 SQL `GRANT`는 서로 다른 게이트로 검증한다.
- `user_metadata`를 권한 판정에 사용하지 않고 `app_metadata` 또는 서버에서 고정한 관리자 ID를 검증한다.
- 브라우저에는 publishable key만 사용하고 secret/service-role key는 Vercel 서버 코드에만 둔다.
- migration 적용 후 security advisor와 performance advisor를 모두 실행하고, 경고를 검토한 뒤 TypeScript 타입을 재생성한다.
- DB 변경 테스트에는 정상 쿼리뿐 아니라 비로그인·일반 사용자·관리자 권한과 실패 rollback 또는 forward-fix 경로를 포함한다.

### Vercel

- Vercel 팀·프로젝트·배포 목록을 먼저 조회하고 `.vercel/project.json`과 실제 대상이 일치하는지 확인한다.
- Development, Preview, Production 환경변수의 이름과 누락 여부만 비교하며 값은 출력하지 않는다.
- feature/PR branch는 Preview, `main`만 Production으로 배포한다.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`가 실패한 상태에서는 배포하지 않는다.
- DB 변경이 있는 배포는 호환 가능한 migration 검증 → Supabase advisor·타입 생성 → Vercel Preview smoke test → Production 승격 순서를 지킨다.
- Preview를 검증한 경우 같은 artifact를 promote하는 방식을 우선하고, Production 장애 시 Vercel rollback을 사용한다.
- 배포 후 build log와 runtime error를 확인하고 결과 URL, commit, 상태, 오류 수를 개발일지에 남긴다.
- Vercel Cron은 Production에서만 실행하고 `CRON_SECRET` 인증 실패·성공 경로를 모두 검증한다.

### 연결 실패 또는 도구 부재

플러그인 인증, 프로젝트 선택, 비용 확인, 환경변수가 없으면 우회해서 Production을 변경하지 않는다. 로컬에서 진행 가능한 구현과 테스트까지만 수행하고 작업 상태를 `진행 중` 또는 `막힘`으로 기록하며 정확한 재개 조건을 남긴다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
