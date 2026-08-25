# [WU-05] counted-only 집계·방문 검증·moderation 엔진

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-05 |
| 상태 | 진행 중 |
| 작업일 | 2026-08-25 |
| 담당 | B1 |
| 대상 AC | AC-03~14 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-03, WU-04 fixture |
| 다음 작업 단위 | WU-06 또는 B1 후속 WU-09 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 원본 반응에서 공개 가능한 행만 원자적으로 집계하고, 방문 증명과 moderation 실패가 마지막 정상 projection을 훼손하지 않게 한다.
- 세션 범위: counted-only summary, 방문 proof 판정, moderation 전이·감사 이벤트, 실패 rollback.
- 완료 조건: AC-03~14의 WU-05 엔진 범위와 실패·복구 테스트가 원격에서 통과한다.
- 범위 밖 항목: Auth HTTP API(WU-09), 브라우저 위치 route(WU-10), 운영 rate-limit 큐(WU-11).

## 2. 무엇을 만들었는가

- checkpoint 1: 식당별 advisory lock, active+`counted` 필터, summary upsert, 반응 변경 trigger를 구현했다.
- checkpoint 2 진행 중: 버전 설정, Haversine 거리·정확도 판정, 24시간 만료 계산, proof 상태·소유권·재사용 판정과 원자 소비 함수를 구현했다.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 로컬 Docker와 Supabase CLI access token이 없어 원격 migration 이력을 만들지 않는 checkpoint 검증 경로가 필요했다.

## 4. 어떻게 해결했는가

- checkpoint 1: 서로 다른 식당은 막지 않는 transaction advisory lock과 단일 upsert를 사용했다. 함수는 `private` schema에 두고 클라이언트 실행 권한을 제거했다.
- 완성 전 migration을 원격 이력에 올리지 않고 migration+pgTAP을 하나의 원격 transaction에서 실행한 뒤 rollback했다.

## 5. 테스트와 검증

- checkpoint 1 원격 rollback 검증: pgTAP 16번까지 성공, counted insert·kind 변경·held 제외·잘못된 counted 실패·마지막 정상 projection 보존 확인.
- 검증 후 원격 함수 미존재, 기존 WU-04 12건 summary 유지 확인. 완성 migration은 아직 적용하지 않았다.

## 6. 변경된 파일

- `supabase/migrations/20260825060116_wu_05_reaction_engine.sql`
- `supabase/tests/wu_05_reaction_engine_test.sql`
- `docs/DEVELOPMENT_PRIORITY.md`
- `docs/development-logs/INDEX.md`
- `docs/development-logs/2026-08-25_WU-05_reaction-engine.md`

## 7. 남은 위험과 미해결 항목

- moderation 전이는 다음 checkpoint에서 구현한다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. checkpoint 1 원격 rollback 테스트를 통과시킨다.
2. checkpoint 2 원격 rollback 테스트를 통과시킨다.
3. moderation 전이·감사·전체 회귀를 구현한다.

## 9. 세션 업데이트

### 2026-08-25 — checkpoint 1

- 추가 구현: counted-only summary 함수와 자동 refresh trigger.
- 새 문제 또는 막힘: 로컬 Docker·CLI access token 부재.
- 해결 또는 시도: 짧은 transaction, 식당별 advisory lock, 최소 함수 권한, 원격 rollback 테스트 적용.
- 검증 결과: checkpoint 1 pgTAP 16번까지 성공, rollback과 기존 seed 보존 확인.
- 현재 재개 지점: checkpoint 2 방문 proof 판정 구현.

### 2026-08-25 — checkpoint 2

- 추가 구현: `p0-v1`의 120m·100m·24시간 설정, 위치 판정, proof 상태·소유권·만료·원자 소비 함수.
- 새 문제 또는 막힘: 없음.
- 해결 또는 시도: 원본 좌표를 함수 인자로만 사용하고 DB에는 파생 시각·digest만 유지.
- 검증 결과: 원격 rollback pgTAP 35번까지 성공. migration 미적용과 기존 seed summary·proof 보존 확인.
- 현재 재개 지점: checkpoint 3 moderation 상태 전이와 감사 이벤트.
