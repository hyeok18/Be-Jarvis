# [WU-00] 작업 시작 안내와 push 충돌 방지 보강

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-00 독립 운영 보강 |
| 상태 | 완료 |
| 작업일 | 2026-08-25 |
| 담당 | 공통 |
| 대상 AC | 팀 동시 개발 안전 기반 |
| 이전 기록 | [최초 WU-00 기록](./2026-08-25_WU-00_development-governance.md) |
| 다음 작업 단위 | WU-04 합성 seed |

## 무엇을 만들었는가

- 모든 구현 시작 전에 예상 시간 범위·변동 요인·사용자가 할 수 있는 준비·수정 예정 공용 파일을 먼저 알리는 규칙을 추가했다.
- 완료 게이트 뒤에는 변경을 즉시 커밋하되 push 전에 원격을 갱신하고 충돌을 검사하도록 종료 절차를 강화했다.
- `pnpm run check:push-safety`로 작업 트리, 현재 branch, upstream 선행 commit, `origin/main` 동일 파일 변경, 미병합 원격 branch 겹침을 검사한다.
- 스크립트가 충돌 후보를 찾으면 exit code 2로 push를 막고 겹친 branch와 파일을 출력한다.

## 무엇이 문제였고 어디에서 막혔는가

- 문제: 기존 규칙은 공용 파일 수정 전 알림과 force push 금지는 있었지만 예상 시간·대기 중 사용자 준비·push 직전 원격 재검증 순서를 강제하지 않았다.
- 막힌 지점: 문서 확인만으로는 매번 동일한 원격 비교를 재현하기 어려웠다.
- 영향: 네 명이 동시에 같은 migration·lockfile·상태 문서를 수정하면 push 또는 PR 단계에서 뒤늦게 충돌을 발견할 수 있었다.

## 어떻게 해결했는가

- 규칙과 자동 검사를 함께 추가했다. 자동 검사는 Git에서 확인 가능한 상태를 차단하고, GitHub 열린 PR·팀 채팅의 활성 파일 목록은 사람이 마지막으로 대조하도록 역할을 분리했다.
- commit은 로컬 복구 지점이라 즉시 만들고, 공유 상태를 바꾸는 push만 충돌 점검 뒤에 실행하도록 구분했다.
- force push나 자동 충돌 해소는 허용하지 않고, 겹치면 통합 담당을 먼저 정하도록 했다.

## 테스트와 검증

| 검증 항목 | 실행 방법 | 결과 |
|---|---|---|
| 문법 검사 | `node --check scripts/check-push-safety.mjs` | 성공 |
| 정적 검사 | `pnpm run lint`, `pnpm run typecheck` | 성공, 오류 0건 |
| 기존 테스트 | `pnpm test` | 성공, 2 files·16 tests |
| 실제 pre-push 검사 | 커밋 후 `pnpm run check:push-safety` | 커밋 뒤 실행하여 결과 기록 |
| 비밀값 검사 | 변경 파일 패턴 검색 | 커밋 전 실행 |

## 변경된 파일

- `AGENTS.md`
- `docs/TEAM_GIT_GUIDE.md`
- `scripts/check-push-safety.mjs`
- `package.json`
- `docs/DEVELOPMENT_PRIORITY.md`
- `docs/development-logs/INDEX.md`
- `docs/development-logs/2026-08-25_WU-00_preflight-push-safety.md`

## 남은 위험과 미해결 항목

- Git만으로 remote branch가 실제 활성 PR인지 판정할 수 없다. 출력된 겹침은 GitHub 열린 PR과 팀 채팅에서 최종 확인해야 한다.
- 팀원이 아직 push하지 않은 로컬 변경은 탐지할 수 없으므로 작업 시작 알림과 공용 파일 예약이 계속 필요하다.

## 다음 작업에서는 어떻게 해야 하는가

1. WU-04 시작 전에 45~75분 예상과 `supabase/seed.sql` 등 공용 파일을 다시 알린다.
2. 팀원들의 활성 branch·WU·수정 파일을 확인한 뒤 seed 구현을 시작한다.
3. 완료 즉시 커밋하고 `pnpm run check:push-safety`가 통과한 경우에만 일반 push한다.
