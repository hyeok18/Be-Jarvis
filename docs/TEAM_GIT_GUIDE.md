# 4인 팀 Git·GitHub·AI 개발 가이드

## 1. 목표

24시간 안에 네 명이 동시에 개발하되 `main`을 항상 배포 가능한 상태로 유지한다.

- 저장소: <https://github.com/hyeok18/Be-Jarvis>
- 구현 계약: [`PRD.md`](../PRD.md)
- 작업 보드: [`DEVELOPMENT_PRIORITY.md`](./DEVELOPMENT_PRIORITY.md)

현재 제품은 별점·종합점수·리뷰 신뢰도를 사용하지 않는다. 세 반응, 방문 증명, 개인 매칭, 확인된 YouTube 영상 근거가 모든 구현과 리뷰의 기준이다.

## 2. 담당과 충돌 파일

| 담당 | 주 작업 | 주요 충돌 파일 |
|---|---|---|
| A1 | 반응·매칭·상세 UI | `src/app/`, UI DTO |
| A2 | Kakao 지도·크리에이터 레이어·반응형 | 지도 컴포넌트, 전역 스타일 |
| B1 | Supabase Auth·방문 증명·반응·RLS | migration, DB 타입 |
| B2 | YouTube 동기화·후보 확인·Cron·백업 | API adapter, 관리자 UI, `vercel.json` |

담당은 소유권이 아니라 충돌 방지를 위한 첫 책임자다. `package.json`, lockfile, migration, 공통 타입, 전역 스타일은 수정 전에 팀 채팅에 알린다.

## 3. 표준 흐름

```text
git status와 최신 일지 확인
→ 최신 main 받기
→ 한 WU용 짧은 branch 생성
→ 구현·테스트·수동 검증
→ 개발일지·INDEX·우선순위 동기화
→ 필요한 파일만 commit·push
→ 작은 PR과 Vercel Preview
→ 다른 팀원 검토 후 main 병합
```

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/reaction-submit
```

브랜치 예시:

- `feat/visit-checkin`
- `feat/reaction-moderation`
- `feat/creator-sync`
- `fix/youtube-stale-fallback`

작업 시작 알림 예시:

```text
[B1] WU-10 위치 체크인 시작. 예상 60~90분. visit proof migration·server route·테스트 수정 예정.
그동안 팀은 supabase migration·DB 타입·package lock 수정을 피하고 활성 branch·수정 파일을 공유해 주세요.
```

모든 작업 시작 알림에는 예상 시간 범위, 변동 요인, 사용자가 기다리는 동안 할 수 있는 준비, 수정 예정 공용 파일을 포함한다. 예상이 크게 바뀌면 새 범위를 바로 공유한다.

## 4. 로컬 검증과 커밋

```bash
git status
git diff
pnpm run check:env
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

모든 명령이 매 단위에 필요한 것은 아니지만 생략 이유를 개발일지에 적는다. DB 변경은 migration, RLS, 명시적 GRANT, 실패 권한을 함께 확인한다.

`git add .`보다 필요한 파일만 추가한다. `.env.local`, 위치 응답, 영수증, API 응답, 임시 CSV, 화면 캡처를 실수로 포함하지 않는다.

```bash
git add src/domain/reactions.ts tests/reaction.test.ts
git commit -m "feat: add verified reaction aggregation"
pnpm run check:push-safety
git push -u origin feat/reaction-submit
```

PR 설명에는 구현, 검증, AI 사용, 위험과 후속 작업을 적는다.

### 푸시 직전 충돌 검사

`check:push-safety`는 먼저 `git fetch --prune origin`을 실행하고 아래 조건을 확인한다.

- 커밋 뒤 작업 트리가 깨끗한가?
- 현재 branch가 `main`이 아닌가?
- 추적 중인 같은 원격 branch에 로컬에 없는 commit이 생기지 않았는가?
- branch를 만든 뒤 `origin/main`이 동일 파일을 수정하지 않았는가?
- 아직 main에 병합되지 않은 다른 원격 branch가 동일 파일을 수정하지 않았는가?
- `package.json`, lockfile, migration, seed, 생성 DB 타입, 전역 스타일, 작업 상태 문서 같은 공유 파일을 누가 수정 중인지 팀 채팅과 일치하는가?

검사에서 겹친 branch·파일이 나오면 커밋은 보존하되 푸시를 중단한다. GitHub의 열린 PR과 팀 채팅에서 해당 branch가 실제 활성 상태인지 확인하고, 한 명을 통합 담당으로 정해 최신 commit을 반영·재검증한 뒤 다시 실행한다. 원격 branch 선행 commit, 동일 파일 충돌, 불명확한 담당 상태를 force push로 해결하지 않는다.

## 5. 제품별 리뷰 체크리스트

- 별점·평균·종합점수·리뷰 신뢰도 계약이 다시 생기지 않았는가?
- 공개 반응 값이 좋아요·그냥 그래요·싫어요 셋으로 제한되는가?
- `counted` 외 상태가 공개 집계에 들어가지 않는가?
- 증명 없는 반응이 개인 전용으로 처리되는가?
- 사용자·식당당 현재 반응 한 개와 변경 감사 기록이 지켜지는가?
- 하나의 위험 신호로 알바·봇을 확정하지 않는가?
- 원본 위치·IP·영수증·비밀값을 저장하거나 로그에 남기지 않는가?
- YouTube 페이지 scraping, 영상·자막·댓글 저장이 없는가?
- 자동 영상-식당 후보가 관리자 확인 전에 공개되지 않는가?
- 구독자 수가 최신 API 원값이고 숨김을 0으로 처리하지 않는가?
- 구독자 수를 자체 공신력·식당 품질 점수로 변환하거나 합산하지 않는가?
- YouTube 출처와 원본 링크, 데이터 기준 시각이 보이는가?
- 오류·로딩·빈 결과·stale·위치 거부 상태가 있는가?

`blocker`, `suggestion`, `question`으로 의견을 구분한다. 모든 blocker와 Preview 실패를 해결하기 전에는 병합하지 않는다.

## 6. Supabase 협업

- migration은 B1이 순서를 관리하고 `supabase/migrations/`를 단일 진실원본으로 사용한다.
- application table은 RLS를 켜고 Data API 자동 노출을 가정하지 않는다.
- `anon`, `authenticated`의 SQL GRANT와 RLS를 별도로 테스트한다.
- 사용자가 moderation 상태를 `counted`로 직접 바꿀 수 없어야 한다.
- 정책의 `user_id`와 모든 FK 조회 경로를 인덱스한다.
- advisor와 TypeScript DB 타입 생성 후에만 DB 단위를 완료한다.
- Production DDL은 사용자 승인과 Preview 호환성 검증 전에는 적용하지 않는다.

## 7. YouTube Data API 협업

- 팀이 합의한 allowlist 채널만 동기화한다.
- HTML scraping 대신 `channels.list`, uploads playlist, `playlistItems.list`, `videos.list`를 사용한다.
- 자동 장소 추출은 `candidate`, 관리자 확인만 `confirmed`다.
- 비인가 API 데이터는 30일 안에 새로고침하거나 삭제한다.
- 삭제·비공개·stale 영상은 공개 근거에서 제외한다.
- `subscriberCount`와 `hiddenSubscriberCount`를 원본 의미대로 사용한다.
- API 키와 원본 응답 전체를 PR, 로그, 개발일지에 붙이지 않는다.
- quota 사용과 실패 수만 sync log에 기록한다.

## 8. Vercel Preview와 Production

- feature/PR branch는 Preview, `main`만 Production으로 배포한다.
- Development, Preview, Production 환경변수는 이름만 비교하고 값은 출력하지 않는다.
- DB 변경은 호환 migration → advisor·타입 → Preview smoke → 같은 artifact 승격 순서를 따른다.
- Cron은 Production에서만 실행하고 `CRON_SECRET` 실패·성공을 검증한다.
- 배포 후 build log와 runtime error를 확인한다.

Preview 최소 점검:

- 페이지와 지도 fallback이 열리는가?
- 공개 화면에 금지된 별점·종합점수가 없는가?
- 세 반응과 매칭도가 보이는가?
- confirmed 영상만 보이고 출처 링크가 동작하는가?
- 390px·1440px와 키보드 흐름이 동작하는가?

## 9. 비밀값과 개인정보

GitHub에 올리지 않는다.

- `.env`, `.env.local`
- Supabase secret/service-role key
- Kakao REST API key
- YouTube Data API key
- `CRON_SECRET`
- 관리자 비밀번호·세션 토큰
- 원본 GPS 응답·IP·영수증·실제 개인정보

```text
브라우저 허용: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_KAKAO_MAP_APP_KEY
서버 전용: SUPABASE_SECRET_KEY, KAKAO_REST_API_KEY, YOUTUBE_DATA_API_KEY, CRON_SECRET
```

키가 커밋되면 파일만 지우지 말고 즉시 폐기·재발급하고 팀에 알린다.

## 10. 장애 복구

### Production 장애

1. 팀 채팅에 증상과 영향 범위를 알린다.
2. GitHub Revert PR을 만든다.
3. Revert Preview를 확인하고 병합한다.
4. 필요하면 마지막 정상 Vercel 배포를 사용한다.
5. 원인은 별도 `fix/` branch에서 수정한다.

`git reset --hard`나 강제 push를 공동 복구 수단으로 쓰지 않는다.

### 반응 집계 실패

- 마지막 정상 reaction summary를 유지한다.
- 실패한 원본·이벤트 상태를 성공으로 수동 변경하지 않는다.
- 보류 반응을 공개에 직접 더하지 않는다.

### YouTube 동기화 실패

- sync run을 실패로 남기고 재시도한다.
- 30일 이내 데이터는 기준 시각과 함께 유지할 수 있다.
- 30일을 넘긴 구독자 수와 영상 근거는 stale 처리한다.
- 다른 scraping 경로로 우회하지 않는다.

## 11. 발표 전 체크리스트

- [ ] `main`의 check:env, lint, typecheck, test, build 성공
- [ ] 공개 화면 별점·평균·종합점수·신뢰도 0건
- [ ] 세 반응 counted-only 집계와 미인증 private-only 확인
- [ ] 위치 체크인 성공·거부·거리초과·만료 확인
- [ ] held·rejected가 공개 분포에 미반영
- [ ] confirmed·candidate·stale·hidden creator 상태 확인
- [ ] YouTube 원본 링크와 출처 표시
- [ ] Production과 최신 Preview 접속 성공
- [ ] 모바일·데스크톱·키보드 시연 성공
- [ ] 전체 발표 흐름 3회 연속 성공
