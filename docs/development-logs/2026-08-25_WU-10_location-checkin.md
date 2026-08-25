# [WU-10] 위치 체크인 방문 증명

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-10 |
| 상태 | 진행 중 |
| 작업일 | 2026-08-25 |
| 담당 | B1 |
| 대상 AC | AC-07, AC-08, AC-13 중 방문 토큰 재사용 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-03, WU-05, WU-09 |
| 다음 작업 단위 | WU-11 rate limit·위험 신호·보류 큐 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 로그인 사용자가 동의한 위치 체크인으로 단기 방문 proof를 발급받고 반응에 한 번만 사용하되 원본 위치를 보존하지 않는다.
- 세션 범위: 120m·정확도 100m·24시간 판정, digest 기반 proof 발급·소비, 반응 공개 전환, 브라우저 권한·실패 UI.
- 완료 조건: 정상 체크인이 `counted` 반응으로 이어지고 권한 거절·정확도 부족·거리 초과·만료·재사용이 공개 집계를 바꾸지 않으며 품질 게이트가 통과한다.
- 범위 밖 항목: 계정·네트워크 rate limit과 행동 위험 신호 생성(WU-11), 영수증·QR 등 단계 상승 증명(P1).

## 2. 무엇을 만들었는가

- 구현 또는 문서화한 내용: 진행 중.
- 사용자 또는 시스템 동작 변화: 진행 중.

변경한 파일:

- `supabase/migrations/20260825113309_wu_10_location_visit_proof.sql`
- `docs/DEVELOPMENT_PRIORITY.md`
- `docs/development-logs/INDEX.md`
- `docs/development-logs/2026-08-25_WU-10_location-checkin.md`

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: 로컬 sandbox에서 Supabase CLI의 사용자 프로필 telemetry 파일 쓰기가 차단됐다.
- 막힌 지점: migration 생성 전 CLI 도움말 확인.
- 영향: 권한 승인 후 CLI로 migration을 정상 생성했으며 구현에는 영향이 없다.

## 4. 어떻게 해결했는가

- 원인: Supabase CLI가 저장소 밖 사용자 프로필에 자체 상태 파일을 쓴다.
- 선택한 해결 방법: 사용자 승인 범위에서 저장소 고정 버전 CLI의 `migration new`만 실행했다.
- 다른 선택지를 쓰지 않은 이유: 임의 timestamp 파일 생성은 저장소의 migration 생성 규칙을 위반한다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 관련 단위 테스트 | 구현 후 실행 | 미실행 | 구현 진행 중 |
| 정적 검사 | 구현 후 실행 | 미실행 | 구현 진행 중 |
| 빌드 | 구현 후 실행 | 미실행 | 구현 진행 중 |
| 수동 AC 검증 | 구현 후 실행 | 미실행 | 구현 진행 중 |
| 실패·복구 경로 | 구현 후 실행 | 미실행 | 구현 진행 중 |

- 통과한 AC: 없음(진행 중).
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 구현 전 세션 시작 기록 단계다.
- 테스트 데이터 안전 확인: 합성 데이터만 사용 예정.
- 비밀값 노출 확인: 없음.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `supabase/migrations/20260825113309_wu_10_location_visit_proof.sql` | Supabase CLI로 생성한 WU-10 schema 변경 진실원본 |
| `docs/DEVELOPMENT_PRIORITY.md` | WU-10 진행 상태 반영 |
| `docs/development-logs/INDEX.md` | 진행 일지와 재개 지점 연결 |
| `docs/development-logs/2026-08-25_WU-10_location-checkin.md` | 구현·문제·검증·인계 기록 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 브라우저 위치 권한은 자동 테스트만으로 실제 OS 권한 창까지 완전히 재현하기 어렵다.
- 후속 작업 후보: WU-11에서 rate limit과 위험 신호를 proof·반응 명령 앞단에 추가한다.
- 사용자 또는 외부 입력이 필요한 사항: 최종 수동 검증에서 실제 브라우저 위치 권한 허용 또는 거절 동작이 필요할 수 있다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. proof 발급·소비 migration과 pgTAP 경계를 먼저 완료한다.
2. 인증된 체크인 Route Handler와 반응 token 전달 계약을 연결한다.
3. 브라우저 UI와 실패·복구·원본 위치 비저장 검증까지 통과한 뒤 WU-11을 `다음`으로 바꾼다.

## 9. 세션 업데이트

### 2026-08-25 — 시작

- 추가 구현: WU-10 상태와 작업 범위·완료 조건을 문서화하고 Supabase CLI로 migration 파일을 생성했다.
- 새 문제 또는 막힘: CLI의 사용자 프로필 telemetry 쓰기가 sandbox에서 차단됐다.
- 해결 또는 시도: 승인된 고정 버전 Supabase CLI 명령만 다시 실행했다.
- 검증 결과: 대상 프로젝트 `Be-jarvis`가 `ap-northeast-2`, `ACTIVE_HEALTHY`임을 읽기 전용으로 재확인했다.
- 현재 재개 지점: proof 발급·소비 SQL과 pgTAP 작성.

### 2026-08-25 — checkpoint 1

- 추가 구현: service-role 전용 위치 proof 발급 함수, digest 기반 proof 반응 승격·원자 소비 함수, 120m·100m·24시간·소유권·만료·재사용 pgTAP을 추가했다.
- 새 문제 또는 막힘: 최초 테스트 계획이 실제 assertion 33개보다 4개 적었다.
- 해결 또는 시도: assertion 목록을 재확인해 plan을 33으로 맞추고 동일 migration+test transaction을 다시 실행했다.
- 검증 결과: 원격 rollback transaction에서 WU-10 pgTAP 33/33이 오류 없이 실행됐고, 직후 함수 미존재·합성 proof 0건으로 rollback을 확인했다.
- 현재 재개 지점: 체크인 Route Handler와 기존 반응 API의 proof token digest 연결.
