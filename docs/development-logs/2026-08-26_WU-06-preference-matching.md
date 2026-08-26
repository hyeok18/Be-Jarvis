# [WU-06] 취향 입력과 나와의 매칭 연결

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-06 후속 |
| 상태 | 완료 |
| 작업일 | 2026-08-26 |
| 담당 | A3 (A1 인계) |
| 대상 AC | 취향 입력 저장, 개인화 매칭 표시 |
| 선행 작업 | WU-06 공개 지도 셸과 mock 반응·매칭 UI |
| 다음 작업 단위 | WU-15 실제 데이터 통합 후 운영 smoke |

## 1. 이번 작업의 목표

- 해결하려는 문제: 취향 입력을 저장해도 기존 고정 매칭 결과만 표시되는 문제
- 세션 범위: 설문 답변을 개인 취향 프로필로 변환하고 지도·탐색·저장 화면의 매칭을 재계산
- 완료 조건: 저장된 답변으로 매칭이 갱신되고, 피하고 싶은 음식은 제외 상태로 표시되며 자동 검증 통과
- 범위 밖 항목: 서버 동기화, 공개 집계 점수 변경

## 2. 무엇을 만들었는가

- 설문 답변을 축별 취향값과 제외 음식 태그로 변환하는 로컬 매칭 어댑터를 추가했다.
- 저장된 답변이 있으면 식당별 프로필을 기준으로 `calculateRestaurantMatch`를 다시 실행하도록 연결했다.
- 실제 공개 데이터 어댑터와 fixture에 식당 취향 프로필을 함께 전달하도록 보완했다.

변경한 파일:

- `src/domain/preference-matching.ts`
- `src/components/app/mobile-app-shell.tsx`
- `src/components/map/map-explorer-data.ts`
- `src/components/map/map-explorer-fixture.ts`
- `src/components/public-data/public-restaurant-ui-adapter.ts`
- `tests/preference-matching.test.ts`

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: 설문 결과는 localStorage에 저장됐지만 화면의 매칭 결과는 초기 데이터에서 갱신되지 않았다.
- 막힌 지점: 없음
- 영향: 사용자가 취향을 저장해도 “나와의 매칭”이 취향과 무관하게 보였다.

## 4. 어떻게 해결했는가

- 원인: 앱 셸이 `personalMatches`를 그대로 Map으로 만들고 저장된 설문 답변을 계산에 사용하지 않았다.
- 선택한 해결 방법: 브라우저 로컬 답변을 도메인 프로필로 변환한 뒤 각 식당 취향 프로필과 기존 매칭 알고리즘을 재계산했다.
- 다른 선택지를 쓰지 않은 이유: P0 정책상 취향 데이터는 서버 동기화 없이 브라우저 로컬에만 저장해야 한다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| 관련 단위 테스트 | Vitest 직접 실행 | 성공 | 27 files passed, 148 tests passed, 2 skipped |
| 정적 검사 | ESLint·TypeScript 직접 실행 | 성공 | 오류 없음 |
| 빌드 | Next.js webpack production build 직접 실행 | 성공 | Next.js 16.3.2 |
| 수동 AC 검증 | 미실행 | 미실행 | 브라우저 자동화 도구 미연결; 도메인 테스트와 production build로 대체 |
| 실패·복구 경로 | 빈 답변·제외 태그 계산 테스트 | 성공 | 빈 답변은 기존 매칭 유지, 제외 음식은 `excluded` |

- 통과한 AC: 답변 변환, 매칭 재계산, 음식 제외
- 실패한 AC: 없음
- 미실행 테스트와 이유: 실제 브라우저 클릭 검증은 도구 미연결
- 테스트 데이터 안전 확인: 합성 데이터만 사용
- 비밀값 노출 확인: 없음

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `src/domain/preference-matching.ts` | 설문 답변을 로컬 취향 프로필로 변환 |
| `src/components/app/mobile-app-shell.tsx` | 저장된 답변 기반 매칭 재계산 |
| `src/components/map/map-explorer-data.ts` | 식당 취향 프로필 데이터 전달 |
| `src/components/map/map-explorer-fixture.ts` | fixture 프로필 연결 |
| `src/components/public-data/public-restaurant-ui-adapter.ts` | 실제 데이터 프로필 연결 |
| `tests/preference-matching.test.ts` | 정상·제외 경로 회귀 테스트 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 설문 선택지와 실제 식당 태그의 운영 데이터 매핑은 후속 데이터 검증이 필요하다.
- 후속 작업 후보: WU-15 실제 데이터 통합 후 Preview에서 설문→매칭→상세 흐름 smoke
- 사용자 또는 외부 입력이 필요한 사항: 없음

## 8. 다음 작업에서는 어떻게 해야 하는가

1. Preview와 Production 배포 상태를 확인한다.
2. 실제 데이터에서 취향 입력 후 매칭·제외 표시를 smoke한다.
3. 결과가 안정적이면 WU-15 운영 smoke로 인계한다.

## 9. 세션 업데이트

### 2026-08-26

- 추가 구현: 취향 입력과 식당별 개인화 매칭 계산 연결
- 새 문제 또는 막힘: 없음
- 해결 또는 시도: 답변→프로필 변환, 제외 음식 하드 제외, 화면 매칭 재계산
- 검증 결과: 정적 검사·테스트·production build 성공
- 현재 재개 지점: 원격 branch push 및 PR/Preview 확인
