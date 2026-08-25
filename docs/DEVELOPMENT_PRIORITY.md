# 개발 우선순위와 작업 단위

이 문서는 [`PRD.md`](../PRD.md)의 24시간 MVP를 구현 가능한 작업 단위로 나눈 실행 보드다. 2026-08-25 인터뷰 3차에서 별점 모델이 폐기되어 WU-02 이후 계약은 WU-20으로 교체한다.

## 1. 운영 원칙

- 한 Codex 세션은 작업 단위 하나만 구현한다.
- `진행 중` 또는 `막힘`이 있으면 최신 일지를 읽고 먼저 이어간다.
- 새 단위는 모든 선행 조건이 `완료`일 때만 시작한다.
- 각 단위는 연결된 AC, 자동 테스트, 수동 검증을 모두 통과해야 `완료`다.
- 공유 타입·migration·package·전역 스타일은 동시에 수정하지 않는다.
- P0와 WU-19 릴리스 게이트 완료 전에는 선택 기능을 시작하지 않는다.
- 상태는 `대기`, `다음`, `진행 중`, `막힘`, `완료`만 사용한다.

## 2. 우선순위 기준

```text
별점 없는 공유 계약
→ 사용자·방문·반응 원본과 권한
→ counted-only 집계와 어뷰징 격리
→ 최소 지도·반응·매칭 흐름
→ YouTube 공식 API·관리자 확인
→ 장애 복구·접근성·배포
→ 전체 리허설
```

## 3. 실행 보드

| 순서 | 작업 단위 | 우선순위 | 제목 | 담당 | 선행 조건 | 대상 AC | 상태 | 완료 증거 |
|---:|---|---|---|---|---|---|---|---|
| 0 | WU-00 | P0 | 작업 단위·개발일지 운영체계 | 공통 | 없음 | 문서 운영 | 완료 | 기존 운영체계와 일지 |
| 1 | WU-01 | P0 | Next.js 앱 셸과 품질 게이트 | 공통 | WU-00 | AC-27 기반 | 완료 | 앱 셸·환경·품질 명령 통과 |
| 2 | WU-02 | P0 | 구 별점 도메인 계약 | A1+B2 | WU-01 | 과거 AC | 완료 | 역사 기록이며 WU-20으로 대체됨 |
| 3 | WU-20 | P0 | 별점 폐지·반응·방문·크리에이터 계약 재설계 | 공통 | WU-02 | AC-01~22 기반 | 완료 | 새 계약·16개 테스트·빌드·390/1440px 검증 통과 |
| 4 | WU-03 | P0 | Supabase 반응·방문·크리에이터 schema와 RLS | B1 | WU-20 | AC-06~13, AC-26 | **다음** | migration, RLS, GRANT, advisor, DB 타입 |
| 5 | WU-04 | P0 | 식당·반응·크리에이터 합성 seed | B1+B2 | WU-03 | AC-03~04, AC-15~19 | 대기 | 식당 30곳, 합성 반응·방문·영상 근거 fixture |
| 6 | WU-05 | P0 | counted-only 집계·방문 검증·moderation 엔진 | B1 | WU-03 | AC-03~14 | 대기 | 집계·토큰·상태·실패 복구 테스트 |
| 7 | WU-06 | P0 | 공개 지도 셸과 mock 반응·매칭 UI | A1 | WU-20 | AC-01~05, AC-20~22 | 대기 | 세 반응·매칭·금지 필드 없는 mock UI |
| 8 | WU-07 | P0 | Kakao 지도·필터·크리에이터 레이어·fallback | A2 | WU-06 | AC-15, AC-23~25 | 진행 중 | 지도·출처·fallback·390/1440·Tab/Enter 검증 통과, WU-06 최종 계약 통합 대기 |
| 9 | WU-08 | P0 | 식당 상세·한 탭 반응·개별 영상 근거 UI | A1 | WU-06 | AC-01~05, AC-15, AC-17~18 | 대기 | 상세 반응·체크인 상태·YouTube 출처 표시 |
| 10 | WU-09 | P0 | 일반 사용자 Auth·반응 생성·변경 | B1 | WU-03, WU-08 | AC-05~07, AC-09~10 | 대기 | 소유권·unique·감사 이벤트 검증 |
| 11 | WU-10 | P0 | 위치 체크인 방문 증명 | B1 | WU-03, WU-09 | AC-07~08, AC-13 | 대기 | 거리·정확도·24시간·원본 좌표 비저장 |
| 12 | WU-11 | P0 | rate limit·위험 신호·보류 큐 | B1+B2 | WU-05, WU-10 | AC-11~14 | 대기 | held/rejected와 마지막 정상 projection |
| 13 | WU-12 | P0 | YouTube Data API 증분 동기화·stale 처리 | B2 | WU-03, WU-04 | AC-15~19 | 대기 | 공식 API, 30일 refresh, hidden/deleted 처리 |
| 14 | WU-13 | P0 | 크리에이터 후보 확인·sync log 관리자 UI | B2 | WU-08, WU-12 | AC-15, AC-19 | 대기 | candidate→confirmed/rejected 공개 경계 |
| 15 | WU-14 | P0 | YouTube Cron·인증·동시 실행 방지 | B2 | WU-12 | AC-14, AC-18 | 대기 | `0 18 * * *`, secret, lock, 실패 로그 |
| 16 | WU-15 | P0 | 30곳 실제 수직 통합 | 공통 | WU-07, WU-11, WU-13 | AC-01~24 | 대기 | DB→집계·매칭·지도·영상 근거 연결 |
| 17 | WU-16 | P0 | 발표 스냅샷·백업 모드 | B2+A1 | WU-15 | AC-14, AC-28 | 대기 | 기준·변경 스냅샷 30초 전환과 원본 불변 |
| 18 | WU-17 | P0 | 오류·반응형·접근성·보안 | A2+공통 | WU-15, WU-16 | AC-24~26 | 대기 | 390/1440px, 키보드, RLS, 비밀값 검사 |
| 19 | WU-18 | P0 | Vercel Preview·Production 배포 | 공통 | WU-14, WU-17 | AC-27 | 대기 | 환경 분리, 같은 artifact, smoke, rollback |
| 20 | WU-19 | P0 | 전체 AC 검증·기능 동결·발표 리허설 | 공통 | WU-18 | AC-01~28 | 대기 | 전체 게이트, 3회 성공, P0/P1 0개 |

WU-20은 기존 ID 사이에 새 번호를 끼우지 않는 운영 규칙에 따라 다음 빈 ID를 사용했지만, schema 고착을 막기 위해 WU-03보다 먼저 실행한다.

## 4. 작업 단위별 완료 조건

### WU-20 — 제품·도메인 계약 재설계

산출물:

- 별점·종합점수·리뷰 신뢰도를 폐기한 PRD·비전·운영 규칙
- 세 반응, 방문 증명, moderation, creator evidence, 개인 매칭 TypeScript 계약
- counted-only 집계, 증명 상태, 최신 구독자 수 정렬, hidden/stale, 매칭 fixture 테스트
- OpenAI를 제거하고 `YOUTUBE_DATA_API_KEY`를 추가한 환경계약
- 새 제품 문구의 앱 셸·README·팀 가이드

완료 조건:

- 활성 코드와 수용 기준에 별점·종합점수 계산이 없음
- 증명 없는 반응과 held 반응이 공개 집계에서 제외됨
- 구독자 수가 파생 점수가 아니라 최신 원값으로만 사용됨
- YouTube 공식 정책의 scraping 금지·30일 최신성·hidden 처리가 문서화됨
- `check:env`, lint, typecheck, test, build가 성공함

### WU-03 — Supabase schema·RLS

산출물:

- `restaurants`, `visit_proofs`, `restaurant_reactions`, `reaction_events`, `restaurant_reaction_summaries`
- `creator_channels`, `creator_videos`, `creator_visit_evidence`, `youtube_sync_runs`
- check·unique·FK·partial/composite index와 migration
- 사용자 소유 RLS, 공개 DTO 경계, 관리자 권한, 명시적 GRANT

완료 조건:

- 원본 반응·방문 증명·감사 이벤트·공개 projection이 분리됨
- 사용자가 자기 반응만 접근하고 moderation 상태를 직접 승격할 수 없음
- 비로그인·본인·다른 사용자·관리자 실패 경로가 통과함
- security/performance advisor 검토와 DB 타입 생성이 완료됨

### WU-04 — 합성 seed

- 식당 30곳과 반응 0·부족·충분 상태를 포함한다.
- counted, pending, held, rejected, private_only와 위험 신호 fixture를 포함한다.
- 실제 리뷰·댓글·개인정보는 포함하지 않는다.
- creator channel·video·candidate·confirmed·stale·hidden 합성 근거를 제공한다.

### WU-05 — 집계·검증·moderation 엔진

- counted-only 세 반응 건수·분포와 0개 상태를 계산한다.
- 위치 정확도·거리·만료·토큰 재사용을 검증한다.
- 위험 신호를 held/rejected로 나누고 마지막 정상 projection을 보존한다.
- 어떤 경로도 세 반응을 숫자 품질점수로 변환하지 않는다.

### WU-06~WU-08 — 공개 사용자 흐름

- WU-06: 별점 금지, 세 반응, 데이터 부족, 매칭도 mock 화면
- WU-07: 카테고리·선택 카드·Kakao 마커·creator 레이어 동기화와 fallback
- WU-08: 한 탭 반응, 체크인 공개 반영 안내, confirmed 개별 영상·구독자 원값·출처

### WU-09~WU-11 — 실제 반응과 방문

- WU-09: Auth, 사용자·식당당 한 개 현재 반응, 변경 감사 이벤트
- WU-10: 위치 체크인, 120m·정확도 100m·24시간 기본값, 원본 좌표 비저장
- WU-11: rate limit, token 재사용, burst·impossible travel·cluster 보류, 실패 복구

### WU-12~WU-14 — YouTube 운영

- WU-12: allowlist uploads playlist 증분 동기화, channels/videos 메타데이터, 30일 refresh
- WU-13: 장소 후보 수동 확인과 candidate 비공개, stale·삭제 상태, sync log
- WU-14: Production Cron, secret 실패·성공, 동시 실행 lock, 재시도와 만료 적용

### WU-15~WU-19 — 통합과 릴리스

- WU-15: Supabase→공개 reaction summary·matching→Kakao·YouTube evidence 수직 통합
- WU-16: 발표 백업과 실패 시 마지막 정상 결과 전환
- WU-17: 오류, 390px/1440px, 키보드, 보안, 금지 필드·비밀값 검사
- WU-18: Preview smoke 후 같은 artifact Production 승격과 rollback 확인
- WU-19: AC-01~28, 전체 명령, 3회 리허설, P0/P1 0개

## 5. AC 추적표

| AC | 주 작업 단위 | 최종 게이트 |
|---|---|---|
| AC-01~05 | WU-20, WU-06, WU-08 | WU-19 |
| AC-06~10 | WU-03, WU-09, WU-10 | WU-19 |
| AC-11~14 | WU-03, WU-05, WU-11, WU-14 | WU-19 |
| AC-15~19 | WU-20, WU-07, WU-08, WU-12, WU-13 | WU-19 |
| AC-20~22 | WU-20, WU-06, WU-15 | WU-19 |
| AC-23~25 | WU-07, WU-17 | WU-19 |
| AC-26 | WU-03, WU-17 | WU-19 |
| AC-27 | WU-01, WU-18 | WU-19 |
| AC-28 | WU-16, WU-19 | WU-19 |

## 6. 상태 변경 규칙

- 작업 시작 시 해당 행을 `진행 중`으로 바꾸고 일지를 만든다.
- 외부 권한·결정 없이는 진행할 수 없으면 `막힘`과 정확한 재개 조건을 적는다.
- 완료 게이트 후에만 `완료`로 바꾸고 증거를 남긴다.
- 팀 병렬 작업이 아니면 `다음` 상태는 하나만 유지한다.
- 새 필수 단위는 기존 ID 사이에 끼우지 않고 다음 빈 `WU-XX`를 쓴다.

## 7. 현재 재개 지점

현재 재개 대상은 **WU-03 — Supabase 반응·방문·크리에이터 schema와 RLS**다.

1. [`2026-08-25_WU-20_reaction-creator-contracts.md`](./development-logs/2026-08-25_WU-20_reaction-creator-contracts.md)의 남은 위험과 인계 순서를 읽는다.
2. Supabase 연결을 읽기 전용으로 확인하고 새 조직·프로젝트·리전·비용이 필요하면 사용자 승인을 받는다.
3. 반응·방문 증명·감사 이벤트·공개 projection·creator sync 원본을 분리한 migration을 작성한다.
4. check·unique·FK·partial/composite index, 사용자 소유 RLS, 공개 DTO, 관리자 권한, 명시적 GRANT를 구현한다.
5. 비로그인·본인·다른 사용자·관리자 실패 경로와 advisor·DB 타입 생성까지 검증한다.
