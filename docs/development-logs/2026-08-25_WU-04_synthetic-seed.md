# [WU-04] 식당·반응·크리에이터 합성 seed

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-04 |
| 상태 | 완료 |
| 작업일 | 2026-08-25 |
| 담당 | B1+B2 |
| 대상 AC | AC-03~04, AC-15~19 |
| 기준 문서 | [PRD](../../PRD.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-03 |
| 다음 작업 단위 | WU-05 counted-only 집계·방문 검증·moderation 엔진 |

## 1. 이번 작업의 목표

- 해결하려는 문제: 공개 반응 분포와 크리에이터 방문 근거의 정상·부족·비공개·stale 경로를 실제 개인정보 없이 재현한다.
- 세션 범위: 식당 30곳, 합성 Auth 주체, 방문 증명, 다섯 moderation 상태, reaction summary, 크리에이터 channel·video·evidence fixture와 DB 검증.
- 완료 조건: seed를 두 번 실행해도 행 수와 감사 이벤트가 중복되지 않고 AC-03~04·AC-15~19 fixture 검증이 통과한다.
- 범위 밖 항목: 실사용자 로그인, 실제 위치 체크인, 자동 집계 함수, YouTube API 동기화, 운영자 확인 UI.

## 2. 무엇을 만들었는가

- 명칭·주소·Kakao ID가 모두 합성임을 표시한 성수 권역 식당 30곳과 5개 카테고리를 만들었다.
- 로그인할 수 없는 합성 Auth 주체 13명과 위치 원본이 없는 방문 proof 22개를 만들었다. 기존 실제 Auth 사용자 1명은 보존했다.
- 반응 원본 29개와 append-only 이벤트 56개를 만들었다. `counted`, `pending`, `held`, `rejected`, `private_only` 및 P0 위험 코드 6종이 모두 포함된다.
- 식당 01은 원본 반응이 있지만 공개 0건, 식당 02는 9건(좋아요 5·그냥 그래요 3·싫어요 1), 식당 03은 12건(7·3·2)인 summary를 만들었다.
- 합성 크리에이터 channel 4개, video 6개, 근거 6개를 만들었다. 공개 가능 confirmed 3개와 candidate·rejected·stale 상태를 분리했다.
- 구독자 공개 2개, hidden 1개, 30일 초과 stale 1개를 만들고 원 구독자 수 외 파생 공신력·신뢰도 점수를 만들지 않았다.
- 모든 DML은 WU-04 고정 UUID namespace를 대상으로 한 set-based upsert이며 삭제를 사용하지 않는다. append-only 이벤트는 `not exists`로 중복을 막는다.

사용자 또는 시스템 동작 변화:

- `Be-jarvis` 원격 프로젝트와 이후 로컬 `supabase db reset`에서 0건·부족·충분 공개 반응 상태와 크리에이터 근거 경계를 즉시 재현할 수 있다.
- 익명 사용자는 식당·summary 30개를 읽을 수 있지만 creator 원본 3개 테이블은 계속 읽을 수 없다. WU-12~13의 안전한 서버 DTO가 확인된 근거만 공개해야 한다.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: 첫 원격 적용에서 pending 반응용 22번 proof의 생성식이 사용자 13을 만들었지만 반응은 사용자 2를 참조해 복합 소유권 FK가 실패했다.
- 막힌 지점: 로컬 Docker가 없어 `supabase db reset` 기반 재현을 실행할 수 없었고, Supabase CLI의 `--linked` 테스트에는 로컬 access token도 없었다.
- 영향: 잘못된 1차 seed는 트랜잭션 전체가 롤백되어 원격 데이터에 부분 적용되지 않았다. CLI 인증 부재는 연결된 Supabase 도구의 원격 SQL 검증으로 대체했다.

## 4. 어떻게 해결했는가

- 원인: proof 10~21용 `proof_no - 9` 계산을 22번 pending proof에도 적용해 사용자 번호가 13으로 계산됐다.
- 선택한 해결 방법: 1~9, 10~21, 22를 명시적으로 나눠 22번만 사용자 2로 만들었다. 수정 후 seed를 연속 두 번 적용하고 행 수·이벤트 수·summary를 비교했다.
- 선택한 해결 방법: 공식 Supabase seed 가이드에 맞춰 schema 문장은 migration에 남기고 `seed.sql`에는 데이터 DML만 두었다. 원격에서는 연결된 SQL 실행기로 같은 파일을 적용하고 22개 조건을 단일 결과로 집계했다.
- 다른 선택지를 쓰지 않은 이유: 실제 사용자 ID 재사용은 개인정보·소유권 경계를 흐리고, seed마다 삭제 후 재삽입하면 감사 이벤트 append-only 계약과 팀원이 만든 데이터가 손상될 수 있다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| seed 원격 적용 | 연결된 Supabase SQL 실행기로 `supabase/seed.sql` 2회 연속 실행 | 성공 | 두 번 모두 commit, fixture 행 수 안정 |
| fixture DB 검증 | `supabase/tests/wu_04_synthetic_seed_test.sql`과 동일한 22개 predicate를 원격 단일 집계로 실행 | 성공 | 22/22, 실패 목록 0 |
| idempotency | 2회 적용 후 UUID namespace 집계 | 성공 | 식당 30, proof 22, 반응 29, event 56, channel 4, video 6, evidence 6 |
| counted-only projection | summary와 active+counted 원본 비교 | 성공 | mismatch 0, 공개 total 0·9·12 |
| 익명 공개 경계 | 트랜잭션에서 `set local role anon` 후 조회·권한 확인 | 성공 | 식당·summary 30, creator 원본 SELECT 3개 모두 false |
| 합성 데이터 정적 검사 | 실제 YouTube URL·이메일 도메인·키 이름·JWT 패턴 검색 | 성공 | 발견 0 |
| 정적 검사 | ESLint, `tsc --noEmit` | 성공 | 오류 0 |
| 앱 단위 테스트 | Vitest | 성공 | 2 files, 16 tests |
| 빌드 | Next.js production build | 성공 | 4개 route 생성 |
| Supabase advisor | security·performance advisor | 검토 완료 | 신규 schema 경고 없음, 기존 Auth WARN 1개·unused index INFO 10개 |

- 통과한 AC: AC-03~04용 0·부족·충분 counted-only fixture, AC-15~19용 confirmed·candidate·stale·hidden creator fixture.
- 실패한 AC: 없음.
- 미실행 테스트와 이유: 로컬 `supabase db reset`은 Docker가 설치되지 않아 미실행했다. CLI 원격 pgTAP은 로컬 access token이 없어 실행되지 않았지만, 동일 테스트 SQL을 연결된 Supabase 실행기로 수행하고 22개 조건을 한 행으로 다시 집계해 전부 통과했다.
- 테스트 데이터 안전 확인: 합성 식당·주소·사용자·반응·YouTube 식별자만 사용했다. 합성 Auth 주체에는 이메일·전화·비밀번호·identity가 없다.
- 비밀값 노출 확인: 없음. publishable/secret/service-role key, DB 연결 문자열, 실제 YouTube 응답을 조회·출력·저장하지 않았다.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `supabase/seed.sql` | 식당·반응·방문·summary·creator 합성 fixture와 idempotent upsert |
| `supabase/tests/wu_04_synthetic_seed_test.sql` | fixture 수치·상태·개인정보·파생 점수 금지 22개 pgTAP 검증 |
| `README.md` | WU-04 완료와 WU-05 재개 지점 표시 |
| `docs/DEVELOPMENT_PRIORITY.md` | WU-04 완료, WU-05 다음 상태와 인계 절차 |
| `docs/development-logs/INDEX.md` | 최신 일지 링크와 다음 작업 등록 |
| `docs/development-logs/2026-08-25_WU-04_synthetic-seed.md` | 구현·실패·해결·검증·인계 기록 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 현재 summary는 seed가 계산한 fixture projection이다. 실제 반응 변경 시 원자적으로 갱신하고 실패 시 마지막 정상값을 보존하는 로직은 WU-05에서 구현해야 한다.
- 남은 위험: creator 원본은 의도적으로 서버 전용이다. WU-12~13에서 confirmed·fresh·active 조건의 안전한 DTO를 만들기 전에는 클라이언트에 직접 노출하면 안 된다.
- 남은 위험: security advisor의 Auth leaked password protection 비활성화 경고가 1개 남아 있다. 실제 로그인 공개 전 [공식 설정 가이드](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)에 따라 활성화하고 회귀 테스트한다.
- 남은 위험: performance advisor의 unused index INFO 10개는 데이터와 운영 쿼리가 적은 초기 상태다. WU-05·12의 실제 쿼리 후 사용 통계를 다시 판단하며 지금 제거하지 않는다.
- 후속 작업 후보: WU-05 집계·방문 검증·moderation 엔진, WU-12 YouTube 증분 동기화.
- 사용자 또는 외부 입력이 필요한 사항: WU-12 전 실제 creator allowlist와 YouTube Data API key가 필요하다. 비밀값은 채팅이나 Git이 아니라 서버 환경변수로만 입력한다.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. 이 일지와 `supabase/seed.sql`의 0·9·12 summary 및 위험 상태 fixture를 먼저 읽고 WU-05만 활성화한다.
2. active+`counted`만 반영하는 원자적 summary 갱신 함수와 마지막 정상 projection 보존 실패 경로를 먼저 구현한다.
3. proof의 소유권·검증 상태·24시간 만료·재사용을 판정하되 원본 좌표를 추가하지 않는다.
4. 단일 위험 신호로 작업 계정을 확정하지 말고 `held/rejected/private_only`와 reason code를 분리한다.
5. WU-04 seed를 다시 2회 적용한 뒤 WU-03 권한 테스트와 WU-04 22개 fixture 테스트를 함께 회귀한다.

## 9. 세션 업데이트

### 2026-08-25

- 추가 구현: 30개 식당, 29개 반응, 22개 proof, 56개 감사 이벤트, 4개 채널, 6개 영상·근거 fixture를 원격에 적용했다.
- 새 문제 또는 막힘: 첫 seed의 22번 proof 사용자 계산 오류, 로컬 Docker·CLI access token 부재.
- 해결 또는 시도: proof 분기 수정, 전체 트랜잭션 재적용, 연결된 원격 SQL로 2회 idempotency와 22개 조건 검증.
- 검증 결과: 원격 22/22, 앱 16/16, lint·typecheck·build 성공.
- 현재 재개 지점: WU-05 원자적 counted-only 집계 함수 설계.
