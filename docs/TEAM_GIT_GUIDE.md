# 4인 팀 Git·GitHub·AI 개발 가이드

## 1. 이 가이드의 목적

이 프로젝트는 24시간 안에 네 명이 동시에 개발한다. `main`을 항상 배포 가능한 상태로 유지하면서 짧은 브랜치와 작은 Pull Request(PR)로 빠르게 합치는 것이 목표다.

- 저장소: <https://github.com/hyeok18/Be-Jarvis>
- 구현 계약: [`PRD.md`](../PRD.md)
- 이전 프로젝트 보관 브랜치: `archive/be-jarvis-legacy-2026-08-25`

`PRD.md`의 필수 범위와 수용 기준이 모든 작업의 기준이다.

---

## 2. 네 명의 기본 담당

| 담당 | 주 작업 | 주요 충돌 파일 |
|---|---|---|
| A1 | 랭킹·상세 UI | `app/`, UI 타입 |
| A2 | Kakao 지도·디자인·반응형 | 지도 컴포넌트, 전역 스타일 |
| B1 | Supabase·Auth·관리자·seed | migration, DB 타입, 관리자 화면 |
| B2 | 규칙·GPT·Cron·백업 | 분석 서비스, API route, `vercel.json` |

담당은 소유권이 아니라 충돌 방지를 위한 첫 책임자다. 막히면 서로 돕되 같은 파일을 동시에 수정하기 전에 팀 채팅에서 알린다.

---

## 3. 처음 한 번 설정

```bash
git clone https://github.com/hyeok18/Be-Jarvis.git
cd Be-Jarvis
npm install
```

다음 순서로 읽는다.

1. `AGENTS.md`
2. `PRD.md`
3. `README.md`
4. 자신이 맡은 수용 기준(AC)

팀에서 받은 환경변수를 `.env.local`에 넣는다. 실제 키를 메신저 공개방, 이슈, PR, 코드에 붙이지 않는다.

---

## 4. 매 작업의 표준 흐름

```text
최신 main 받기
→ 짧은 작업 브랜치 생성
→ 한 가지 기능 구현
→ 로컬 검증
→ 커밋과 push
→ 작은 PR 생성
→ 다른 팀원 검토
→ Vercel Preview 확인
→ main 병합
```

### 4.1 최신 main에서 시작

```bash
git switch main
git pull --ff-only origin main
```

로컬 수정이 남아 있으면 먼저 `git status`를 확인한다. 다른 사람의 변경을 잃을 수 있으므로 `git reset --hard`로 해결하지 않는다.

### 4.2 작업 브랜치 만들기

브랜치는 2~4시간 안에 병합할 수 있는 크기로 만든다.

```bash
git switch -c feat/ranking-ui
```

이름 규칙:

- 기능: `feat/짧은-설명`
- 버그: `fix/짧은-설명`
- 문서: `docs/짧은-설명`
- 테스트: `test/짧은-설명`
- 정리: `chore/짧은-설명`

예시:

```text
feat/restaurant-detail
feat/review-rule-engine
feat/admin-csv-import
fix/map-load-fallback
```

### 4.3 구현 전에 작업 범위를 한 줄로 선언

팀 채팅에 다음 형식으로 남긴다.

```text
[B2] AC-06~08 규칙/GPT 분석 작업 시작. analysis 서비스와 테스트 파일 수정 예정.
```

공유 파일을 수정할 때는 반드시 담당자를 함께 적는다.

### 4.4 변경 확인과 검증

```bash
git status
git diff
npm run lint
npm run typecheck
npm test
npm run build
```

모든 명령이 항상 필요한 것은 아니지만, PR 전에는 자신이 수정한 범위에 해당하는 검증을 실행한다. DB 변경은 migration 적용과 RLS 권한을 함께 확인한다.

### 4.5 필요한 파일만 추가

```bash
git add app/restaurant/page.tsx
git add components/restaurant-score-card.tsx
git add tests/restaurant-score.test.ts
```

가능하면 `git add .`를 피한다. `.env.local`, 임시 CSV, 화면 캡처, API 응답 로그가 실수로 포함될 수 있다.

### 4.6 커밋

```bash
git commit -m "feat: add restaurant trust score detail"
```

권장 접두사:

- `feat:` 기능
- `fix:` 버그
- `test:` 테스트
- `docs:` 문서
- `refactor:` 동작이 같은 구조 개선
- `chore:` 설정·의존성

한 커밋은 한 가지 이유로 설명할 수 있어야 한다.

### 4.7 push와 PR

```bash
git push -u origin feat/restaurant-detail
```

PR 제목 예시:

```text
[AC-04] 식당 상세와 신뢰도 근거 UI 추가
```

PR 설명에 다음을 적는다.

```markdown
## 구현
- 무엇을 만들었는지

## 검증
- npm test: 성공
- npm run build: 성공
- 수동 확인: AC-04 절차 통과

## AI 사용
- 어떤 부분에 사용했는지
- 사람이 확인하거나 수정한 부분

## 위험과 후속 작업
- 남은 문제 또는 없음
```

---

## 5. 리뷰 규칙

PR 작성자가 아닌 팀원 한 명이 검토한다. 24시간 프로젝트이므로 작은 PR은 확인 후 빠르게 병합한다.

검토자는 다음을 본다.

- PRD의 해당 AC를 충족하는가?
- 필수 범위를 넘는 기능이 섞이지 않았는가?
- 원본 리뷰와 파생 점수를 분리했는가?
- 하나의 신호로 리뷰 조작을 단정하지 않는가?
- 점수 조정 이유가 설명 가능한가?
- API 키, `.env`, 개인정보가 포함되지 않았는가?
- 오류·로딩·빈 상태가 있는가?
- 실행한 테스트가 변경 위험에 맞는가?

코멘트는 다음 세 단계로 표시하면 빠르다.

- `blocker`: 병합 전에 반드시 수정
- `suggestion`: 가능하면 수정
- `question`: 의도 확인

모든 `blocker`가 해결되고 Preview 검증이 끝나면 병합한다.

---

## 6. Vercel Preview와 Production

- PR 브랜치 push 후 생성된 Preview URL에서 해당 AC를 확인한다.
- Preview가 실패하면 `main`에 병합하지 않는다.
- `main` 병합은 Production 배포를 갱신한다.
- `main`은 발표 가능한 상태를 유지한다.
- H20 기능 동결 후에는 버그 수정 PR만 병합한다.

Preview 점검 최소 항목:

- 페이지가 열리는가?
- 브라우저 콘솔에 치명적 오류가 없는가?
- Supabase 데이터가 보이는가?
- 모바일 390px과 데스크톱 1440px에서 사용할 수 있는가?
- 변경한 수용 기준이 재현되는가?

환경변수는 Vercel에서 Development, Preview, Production 범위를 구분한다. 새 환경변수를 추가한 사람은 `.env.example`에는 이름만 추가하고 팀 채팅에 필요한 환경 범위를 알린다.

---

## 7. 충돌을 줄이는 방법

- 작업 시작 직전에 항상 최신 `main`을 받는다.
- 같은 화면·migration·공통 타입을 동시에 수정하지 않는다.
- PR을 오래 열어두지 않는다.
- `package.json`, lockfile, DB migration은 변경 전에 팀에 알린다.
- DB migration 파일은 B1이 순서를 관리한다.
- 분석 점수 타입과 응답 구조는 B2와 A1이 함께 합의한다.

작업 중 `main`이 바뀌면 다음처럼 반영한다.

```bash
git fetch origin
git merge origin/main
```

충돌이 생기면:

1. `git status`로 충돌 파일을 확인한다.
2. 해당 파일을 작성한 팀원과 유지할 내용을 합의한다.
3. 충돌 표시를 제거하고 파일을 저장한다.
4. 관련 테스트 전체를 다시 실행한다.
5. 해결 커밋을 push한다.

상대 코드를 임의로 지우거나 `git push --force`로 덮지 않는다.

---

## 8. 비밀값과 데이터 안전

절대 GitHub에 올리지 않는다.

- `.env`, `.env.local`
- OpenAI API 키
- Supabase secret/service-role 키
- Kakao REST API 키
- `CRON_SECRET`
- 관리자 비밀번호와 세션 토큰
- 실제 개인 리뷰나 개인정보

브라우저에서 허용되는 키와 서버 전용 키를 구분한다.

```text
브라우저 허용: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_KAKAO_MAP_APP_KEY
서버 전용: SUPABASE_SECRET_KEY, KAKAO_REST_API_KEY, OPENAI_API_KEY, CRON_SECRET
```

서버 전용 키에 `NEXT_PUBLIC_`을 붙이지 않는다. PR 전에 `git diff --cached`로 커밋될 내용을 확인한다.

키가 커밋됐다면 파일만 지우고 끝내지 말고 즉시 팀장에게 알리고 해당 키를 폐기·재발급한다.

---

## 9. AI를 주도적으로 사용하면서 성장하는 방법

AI는 각 팀원의 속도를 높이는 조력자다. 결과를 이해하지 못한 채 복사해서 병합하지 않는다.

### 권장 작업 방식

1. AI에게 `AGENTS.md`, `PRD.md`, 담당 AC를 먼저 읽게 한다.
2. 수정할 파일과 완료 조건을 한 작업으로 제한한다.
3. 구현 전에 짧은 계획과 위험을 요청한다.
4. AI가 만든 diff를 직접 읽고 이해하지 못한 부분을 다시 질문한다.
5. 테스트를 실행하고 실패 원인을 설명하게 한다.
6. PR의 `AI 사용` 항목에 도움받은 부분과 사람이 검증한 부분을 적는다.

### 팀원이 사용할 프롬프트 예시

```text
이 저장소의 AGENTS.md와 PRD.md를 먼저 읽어라.
나는 AC-05 대표 리뷰 선정만 구현한다.
필수 범위를 늘리지 말고, 현재 구조를 확인한 뒤 구현 계획을 제시하고 진행하라.
원본 리뷰를 수정하지 말고 파생 결과로 계산하라.
완료 후 관련 테스트와 npm run typecheck를 실행하고 결과를 보고하라.
```

### 학습을 위한 10분 공유

H12와 H20에 각자 다음 중 하나를 2분씩 공유한다.

- AI가 잘못 제안했고 사람이 바로잡은 부분
- 새로 이해한 기술 개념
- 다른 팀원이 다시 쓸 수 있는 프롬프트
- 테스트가 실제로 잡아낸 버그

이 기록은 길게 작성할 필요 없이 PR 설명이나 팀 메모에 3~5줄로 남긴다.

---

## 10. 문제 발생 시 복구

### 병합 후 Production이 망가진 경우

1. 팀 채팅에 장애와 증상을 알린다.
2. GitHub에서 문제 PR을 `Revert`하는 새 PR을 만든다.
3. Revert PR의 Preview를 확인하고 즉시 병합한다.
4. 필요하면 Vercel에서 마지막 정상 배포를 발표용으로 사용한다.
5. 원인은 별도 `fix/` 브랜치에서 수정한다.

`main` 기록을 지우는 `git reset --hard`나 강제 push를 복구 수단으로 사용하지 않는다.

### 분석이 실패한 경우

- 기존 `active_analysis_run_id`를 유지한다.
- 실행 로그의 실패 원인을 확인한다.
- 발표 중이면 관리자에서 저장된 `after-suspicious-import` 백업을 활성화한다.
- 실패한 실행을 성공으로 수동 변경하지 않는다.

### 초기 데이터가 잘못된 경우

- 원본 행을 삭제하지 않고 비활성화한다.
- seed fixture를 수정한 PR을 검토한다.
- 새 분석을 실행하고 성공 결과를 확인한 뒤에만 공개한다.
- 발표 백업 스냅샷도 다시 생성하고 리허설 3회를 반복한다.

---

## 11. 발표 전 팀 체크리스트

### 각자

- [ ] 내 PR이 모두 병합됐고 로컬 변경이 없음
- [ ] 담당 AC 검증 완료
- [ ] 남은 P0/P1 버그 없음
- [ ] 실제 API 키나 개인정보가 Git에 없음
- [ ] 내 기능의 실패 시 대처 방법을 설명할 수 있음

### 팀 전체

- [ ] `main`의 lint, typecheck, test, build 성공
- [ ] Production과 최신 Preview 접속 성공
- [ ] 관리자 로그인과 수동 분석 성공
- [ ] 마지막 정상 실행 ID 기록
- [ ] 두 발표 스냅샷 전환 성공
- [ ] 모바일·데스크톱 시연 성공
- [ ] 전체 발표 흐름 3회 연속 성공

---

## 12. 가장 짧은 명령 체크리스트

작업 시작:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/my-small-task
```

작업 종료:

```bash
git status
git diff
npm test
git add path/to/changed-file
git commit -m "feat: describe one change"
git push -u origin feat/my-small-task
```

PR 병합 후:

```bash
git switch main
git pull --ff-only origin main
git branch -d feat/my-small-task
```
