# [WU-15] UI 브랜치 통합 담당·비활성 브랜치 결정

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-15 |
| 상태 | 진행 중 |
| 작업일 | 2026-08-26 |
| 담당 | hyeok18 (UI 통합) |
| 대상 AC | AC-01~24 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md), [UI 인계](../HANDOFF_WU-15_WU-16_UI_BASELINE.md) |
| 선행 작업 | WU-07, WU-11, WU-13 |
| 다음 작업 단위 | PR #13 검토·병합과 실제 위치 기기 체크인 smoke |

## 1. 이번 작업의 목표

- UI 충돌 브랜치의 활성 여부와 통합 담당자를 명시해 push 안전검사의 보류 조건을 해소한다.
- 독립 이력 또는 중복 UI 변경을 현재 기준선에 무단 병합하지 않게 한다.

## 2. 무엇을 만들었는가

- 사용자 결정으로 `codex/ui-baseline`의 WU-15 UI 통합 담당자를 **hyeok18**로 지정했다.
- `codex/kakao-map-update`를 비활성·보관 브랜치로 지정했다. `main`과 merge-base가 없으므로 merge, cherry-pick, 전체 복사는 금지한다.
- `codex/mobile-map-prototype`를 비활성·대체됨 브랜치로 지정했다. 홈·상세 UI는 `codex/ui-baseline`이 기준이며, 필요한 변경만 담당자가 선택적으로 반영한다.
- 두 브랜치는 삭제하지 않고 기록 보존 대상으로 유지한다.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: 두 이전 지도/UI 브랜치가 활성 통합 후보로 남아 있어, 공용 홈·상세 파일 충돌과 push 안전검사 보류가 발생했다.
- 막힌 지점: `codex/kakao-map-update`는 `main`과 공통 merge-base가 없고, `codex/mobile-map-prototype`는 홈·상세 변경이 현재 기준선과 겹친다.
- 영향: 담당과 처리 방침이 없으면 PR #13을 기준으로 한 재검증·병합 책임이 불명확했다.

## 4. 어떻게 해결했는가

- 원인: 독립 프로토타입과 현재 `main` 기반 UI 통합 브랜치를 동등한 병합 후보로 취급한 상태였다.
- 선택한 해결 방법: 사용자 결정에 따라 hyeok18를 단일 통합 담당자로 지정하고, 이전 두 브랜치를 비활성·보관으로 분류했다.
- 다른 선택지를 쓰지 않은 이유: `kakao-map-update`의 전체 이식은 이력·계약 충돌 위험이 있고, `mobile-map-prototype`의 직접 병합은 현재 UI 기준선과 동일 파일 충돌을 만든다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 원격 브랜치·PR 확인 | `git ls-remote --heads origin`, `gh pr list` | 성공 | PR #13만 열려 있으며 작성자는 hyeok18다. |
| 이력 관계 확인 | `git merge-base`, `git merge-base --is-ancestor` | 성공 | `kakao-map-update`는 main과 공통 merge-base가 없고, UI 기준선은 main 위에 있다. |
| 문서 일관성 | `git diff --check` | 성공 | 공백 오류 없음. |
| 애플리케이션 품질 게이트 | 해당 없음 | 미실행 | 코드·의존성·배포 설정을 변경하지 않았다. |

- 통과한 AC: 해당 없음. 이 변경은 WU-15 통합 운영 결정이다.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 코드 변경이 없어 lint, typecheck, test, build는 실행하지 않는다.
- 테스트 데이터 안전 확인: 해당 없음.
- 비밀값 노출 확인: 없음.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `docs/HANDOFF_WU-15_WU-16_UI_BASELINE.md` | 담당·비활성 브랜치·보관 규칙을 단일 인계 문서에 반영 |
| `docs/development-logs/2026-08-26_WU-15_ui-branch-integration-decision.md` | 결정 근거와 재개 규칙 기록 |
| `docs/development-logs/INDEX.md` | WU-15 최신 통합 재개 지점 동기화 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: PR #13 병합 전 `main` 또는 다른 활성 브랜치가 같은 파일을 수정할 수 있다.
- 후속 작업 후보: 실제 위치 기기에서 WU-15 체크인 성공·실패·복구 smoke, PR #13 검토·병합.
- 사용자 또는 외부 입력이 필요한 사항: 원격 보관 브랜치의 최종 삭제는 별도 사용자 승인 후에만 수행한다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. hyeok18는 PR #13 병합 전 최신 `main`과 열린 PR을 다시 확인하고 push 안전검사를 실행한다.
2. `codex/kakao-map-update`와 `codex/mobile-map-prototype`를 직접 merge/cherry-pick하지 않는다.
3. 실제 위치 기기에서 WU-15의 남은 체크인·반응 smoke를 실행한다.
