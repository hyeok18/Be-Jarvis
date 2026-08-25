# [WU-20] 별점 폐지·반응·방문·크리에이터 계약 재설계

| 항목 | 내용 |
|---|---|
| 작업 단위 | WU-20 |
| 상태 | 완료 |
| 작업일 | 2026-08-25 |
| 담당 | 공통 |
| 대상 AC | AC-01~AC-22 기반, AC-26~AC-27 계약 |
| 기준 문서 | [PRD](../../PRD.md), [비전 로드맵](../VISION_ROADMAP.md), [개발 우선순위](../DEVELOPMENT_PRIORITY.md) |
| 선행 작업 | WU-02 완료 — 기존 계약은 역사 기록으로만 유지 |
| 다음 작업 단위 | WU-03 Supabase 반응·방문·크리에이터 schema와 RLS |

## 1. 이번 작업의 목표

- 해결하려는 문제: 팀 인터뷰에서 별점·종합평점이 폐기됐지만 코드와 문서는 다면 별점, 리뷰 가중치, 신뢰점수를 중심으로 구성돼 있었다. 리뷰를 잘 쓰지 않는 사용자의 낮은 참여와 댓글·반응 작업 문제도 새 공개 집계 계약으로 해결해야 했다.
- 세션 범위: 제품 문서, 작업 순서, 안전 규칙, 도메인 타입·함수·fixture·테스트, 환경계약, 앱 셸을 세 반응·방문 증명·개인 매칭·크리에이터 방문 근거 모델로 전면 교체한다.
- 완료 조건: 활성 코드에 별점 계산이 없고, 증명·moderation·YouTube 최신성 경계가 테스트되며 `check:env`, lint, typecheck, test, build와 390px·1440px 수동 검증이 모두 성공해야 한다.
- 범위 밖 항목: 실제 Supabase migration·RLS, 실제 위치 체크인, 실제 YouTube API 동기화, 관리자 후보 확인 UI, Production 배포.

## 2. 무엇을 만들었는가

- 공개 입력을 `좋아요`, `그냥 그래요`, `싫어요` 세 반응으로 제한하고 숫자 품질점수로 환산하지 않는 제품 계약을 만들었다.
- `pending`, `counted`, `held`, `rejected`, `private_only` 상태를 정의하고 `counted`만 공개 건수·분포에 포함하는 결정적 집계 함수를 구현했다.
- 로그인과 방문 증명이 없는 원탭 반응은 개인 취향용으로만 남기고 공개 집계에서 제외하도록 설계했다.
- P0 방문 증명을 반경 120m, 정확도 100m 이하, 24시간 유효한 위치 체크인으로 정했다. 원본 좌표와 GPS 응답은 저장·로그하지 않는 경계를 문서화했다.
- 증명 토큰 재사용, 불가능한 이동, 반응 급증, 계정 군집 등 위험 신호를 보류 사유로 정의했다. 단일 신호로 사용자를 작업 계정이라고 단정하지 않고 마지막 정상 공개 집계를 유지하도록 했다.
- P0 공개 자유서술 댓글을 제거해 댓글 작업의 공격 면적을 줄였다.
- YouTube HTML scraping 대신 allowlist와 공식 Data API를 쓰고, 자동 후보는 관리자 확인 전 비공개로 두는 ingestion 계약을 만들었다.
- 채널 구독자 수는 파생 신뢰점수나 식당 합산값이 아니라 최신 API 원값의 개별 근거 정렬에만 사용한다. 숨김 값은 `null`, 30일이 지난 API 데이터는 비공개 처리한다.
- 안 먹는 음식 hard exclusion, 직접 취향, 비슷한 사용자, 과거 만족도를 분리해 계산하는 개인 매칭 계약을 유지했다.
- OpenAI 환경 의존성을 제거하고 `YOUTUBE_DATA_API_KEY`와 YouTube sync/Cron 운영 경계를 추가했다.
- 앱 셸과 메타데이터를 새 제품 문구로 교체하고 모바일·데스크톱 레이아웃을 확인했다.

## 3. 무엇이 문제였고 어디에서 막혔는가

- 문제: WU-02의 다면 별점·리뷰 신뢰도·커뮤니티 가중치 계약이 새 인터뷰 결과와 정면으로 충돌했다.
- 문제: 영수증을 기본 인증으로 강제하면 참여율이 낮아지고, 위치만으로는 실제 식사까지 완벽히 증명할 수 없다.
- 문제: 구독자 수를 공신력으로 보고 파생 `신뢰 점수`를 만들면 YouTube 정책의 파생 지표 제한과 충돌할 수 있고, 인기와 사실성을 혼동하게 된다.
- 문제: TypeScript가 좁은 literal 배열의 `includes` 인자로 더 넓은 위험 신호 union을 허용하지 않아 타입 검사 2건이 중간에 실패했다.
- 막힌 지점: 첫 표준 `pnpm` 실행이 비대화된 기존 `node_modules` 패키지 맵을 재구성하며 오래 대기했고, 비대화된 임시 폴더는 sandbox ACL 때문에 일반 삭제가 거부됐다.
- 영향: 도메인 설계를 확정하기 전에 이전 schema 작업을 진행할 수 없었고, 품질 게이트를 저장소 표준 명령으로 재현하려면 의존성 폴더 복원이 필요했다.

## 4. 어떻게 해결했는가

- 원인: 제품의 신뢰 대상을 하나의 점수로 만들려고 했던 이전 가정과 저마찰 참여·남용 방지 요구가 서로 충돌했다. 도구 문제는 오래된 가상 저장소와 실행 중인 개발 서버가 재구성에 관여한 환경 문제였다.
- 선택한 해결 방법: `공개 반응 분포`, `개인 매칭`, `확인된 크리에이터 방문 근거`를 서로 다른 근거로 분리했다.
- 방문 증명은 완벽한 인증을 약속하지 않고 저마찰 위치 체크인을 기본으로 삼았다. 증명 없는 반응은 개인용, 위험 반응은 보류, 반복 위험에는 추후 영수증 등 선택적 step-up을 적용하도록 했다.
- YouTube는 공식 API 원본 구독자 수만 최신성·출처와 함께 표시하고 개별 근거를 내림차순 정렬한다. 구독자 수를 식당 품질, 영상 진실성, 0~100 점수로 변환하지 않는다.
- 좁은 literal 배열은 `ReadonlySet<ReactionRiskSignal>`로 바꿔 union 입력의 타입 안전성을 유지했다.
- 의존성 폴더는 실행 중이던 로컬 서버를 종료하고 기존 폴더를 저장소 내부 임시 백업으로 옮긴 뒤 lockfile 그대로 복원했다. 새 폴더 검증 후 임시 백업을 삭제했다.
- 다른 선택지를 쓰지 않은 이유: 영수증 강제는 참여 비용과 개인정보 처리 범위를 키우고, 댓글 텍스트 자동 판별은 P0 시간 안에 정확도·설명 가능성·운영 복구를 보장하기 어렵다. YouTube 무단 scraping과 파생 권위점수는 정책·제품 신뢰 양쪽에 불필요한 위험을 만든다.

## 5. 테스트와 검증

| 검증 항목 | 실행 방법·명령 | 결과 | 증거 또는 비고 |
|---|---|---|---|
| YouTube 정책 | 공식 Developer Policies, channels, quota 문서 확인 | 성공 | scraping 금지, 30일 refresh/delete, 숨김 구독자, 원본 값·quota 경계 반영 |
| Supabase 최신 기준 | 공식 2026-05 Developer Update와 Postgres/RLS 지침 확인 | 성공 | 새 테이블 명시적 GRANT와 RLS를 WU-03 게이트로 유지 |
| 환경 계약 | `pnpm run check:env` | 성공 | 7개 키 선언, OpenAI 제거, YouTube 키 포함 |
| 정적 검사 | `pnpm run lint` | 성공 | ESLint 오류 0개 |
| 타입 검사 | `pnpm run typecheck` | 성공 | TypeScript 오류 0개 |
| 전체 단위 테스트 | `pnpm test` | 성공 | 2개 파일, 16개 테스트 통과 |
| 프로덕션 빌드 | `pnpm run build` | 성공 | Next.js 16.3.2, `/`, `/_not-found`, `/api/health` 성공 |
| 반응 집계 | counted-only, 0건, held/private 제외 fixture | 성공 | 세 반응 건수·분포만 반환하고 단일 점수 없음 |
| 방문·moderation | 증명 없음·정상 위치·식당 불일치·위험 신호 fixture | 성공 | private_only, counted, held, rejected 경계 통과 |
| 크리에이터 근거 | confirmed·candidate·hidden·stale fixture | 성공 | confirmed+fresh만 공개, 구독자 원값 내림차순, hidden은 후순위 |
| 개인 매칭 | exclusion·cold-start·직접 취향·과거 만족도 fixture | 성공 | 제외 시 매칭 없음, 가용 신호 재정규화 |
| 브라우저 수동 검증 | 로컬 앱을 390×844, 1440×900에서 확인 | 성공 | 새 제목·3개 핵심 카드, 가로 overflow·오류 overlay·console error/warn 없음 |
| 금지 계약 검사 | `rg`로 활성 코드의 과거 필드·OpenAI 의존성 검색 | 성공 | `rating`, `overallScore`, `reviewTrust`, `finalTrust`, `OPENAI`, `GPT` 결과 0건 |
| 문서 추적 | PRD 수용 기준 행 수 확인 | 성공 | AC-01~AC-28, 28개 |
| diff 정합성 | `git diff --check` | 성공 | 공백 오류 없음, Windows CRLF 안내만 존재 |
| 비밀값 검사 | API secret 형태 정규식 검색 | 성공 | 실제 키·토큰 결과 0건 |

- 통과한 AC: AC-01~AC-22의 제품·도메인 계약과 AC-26~AC-27의 보안·빌드 기반 계약. 실제 DB·지도·API 연결은 해당 후속 WU에서 최종 검증한다.
- 실패한 AC: 없음. 중간 타입 오류 2건과 첫 비대화 의존성 재구성은 수정·복원 후 전체 게이트를 다시 실행해 통과했다.
- 미실행 테스트와 이유: 실제 Supabase RLS는 WU-03, 실제 체크인은 WU-10, 어뷰징 보류 큐는 WU-11, YouTube 동기화는 WU-12~WU-14 범위다.
- 테스트 데이터 안전 확인: 식당, 반응, 위치 증명, 사용자 취향, 채널·영상은 모두 명시적인 합성 fixture다.
- 비밀값 노출 확인: 외부 키·토큰·실제 위치·개인정보를 사용하거나 기록하지 않았다.

## 6. 변경된 파일

| 파일 | 변경 이유 |
|---|---|
| `.env.example` | OpenAI 제거, YouTube 서버 키 계약 추가 |
| `AGENTS.md` | 별점 금지, counted-only, 위치정보, YouTube 정책 불변조건 추가 |
| `PRD.md` | 제품 범위·UX·schema·API·운영·AC를 새 모델로 전면 교체 |
| `README.md` | 제품 설명, 핵심 원칙, 현재 WU 상태 갱신 |
| `docs/PROJECT_CONCEPT.md` | 초기 별점 아이디어를 현재 제품 가설과 문제 해결 전략으로 교체 |
| `docs/VISION_ROADMAP.md` | P0/P1/P2와 성공 지표를 반응·매칭·creator 모델로 교체 |
| `docs/DEVELOPMENT_PRIORITY.md` | WU-20 선행 계약과 WU-03 이후 구현 순서 재설계 |
| `docs/TEAM_GIT_GUIDE.md` | 팀 작업·Supabase·YouTube·Vercel 경계 갱신 |
| `package.json` | 프로젝트 식별자를 새 제품명으로 교체 |
| `scripts/check-env-contract.mjs` | YouTube 기반 환경계약 검증 |
| `src/lib/env-contract.ts` | 서버·클라이언트 환경 키 경계 갱신 |
| `src/domain/types.ts` | 반응·방문·moderation·creator evidence·매칭 타입 |
| `src/domain/algorithm-config.ts` | 버전 있는 반응·방문·매칭·최신성 설정 |
| `src/domain/signals.ts` | 공개 집계, moderation, creator 공개 선택, 개인 매칭 함수 |
| `src/domain/scoring.ts` | 기존 별점·신뢰도 계산 파일 삭제 |
| `src/domain/fixtures.ts` | 새 계약의 합성 fixture |
| `tests/domain-contract.test.ts` | 집계·방문·creator·매칭 계약 테스트 |
| `tests/env-contract.test.ts` | OpenAI 제거·YouTube 키 환경 테스트 |
| `src/app/page.tsx` | 세 반응·매칭·영상 근거 앱 셸 |
| `src/app/layout.tsx` | 새 제품 metadata |
| `src/app/api/health/route.ts` | 새 서비스 식별자 |
| 이 개발일지와 `INDEX.md` | 구현·문제·해결·검증·다음 세션 인계 |

## 7. 남은 위험과 미해결 항목

- 남은 위험: 위치 체크인은 GPS spoofing, 식당 근처 통과, 여러 계정 사용을 완전히 막지 못한다. WU-10~WU-11에서 토큰 재사용·이동·burst·군집 검증과 운영 복구를 실제 DB로 구현해야 한다.
- 남은 위험: 구독자 수는 인기 신호이지 공신력이나 진실의 보증이 아니다. 출시 전 실제 UI 문구와 YouTube API 사용 방식은 정책 검토를 다시 받아야 한다.
- 남은 위험: 사용자 승인 없는 YouTube API 데이터의 30일 refresh/delete와 삭제·숨김 전환은 실제 sync·Cron이 구현되기 전에는 보장되지 않는다.
- 후속 작업 후보: 위치 위험이 반복되는 계정에만 영수증, 결제 토큰, Wi-Fi 등 추가 증명을 요구하는 step-up 실험. P0 완료 전에는 구현하지 않는다.
- 사용자 또는 외부 입력이 필요한 사항: WU-03 시작 전 Supabase 조직·리전·프로젝트 생성 여부와 비용 승인, WU-12 전 실제 creator allowlist·YouTube API key·표시 문구 승인.
- 현재 작업 단위 내부 미해결 항목: 없음.

## 8. 다음 작업에서는 어떻게 해야 하는가

1. WU-03만 활성화하고 이 일지와 `PRD.md`의 schema·권한 섹션을 먼저 읽는다.
2. Supabase 연결 상태를 읽기 전용으로 확인한 뒤 조직·리전·비용이 필요한 새 리소스 생성은 사용자 승인을 받는다.
3. 반응 원본, 방문 증명, 감사 이벤트, 공개 projection, creator sync 원본을 분리한 migration을 작성한다.
4. reaction·moderation check, 사용자·식당 unique, 모든 FK 조회 인덱스, counted·confirmed용 partial index를 추가한다.
5. 사용자 소유 RLS와 공개 DTO·관리자 service role 경계를 분리하고 새 테이블에 명시적 GRANT를 적용한다.
6. 비로그인·본인·다른 사용자·관리자 실패 경로, advisor, DB 타입 생성까지 통과한 뒤에만 WU-03을 완료한다.

## 9. 세션 업데이트

### 2026-08-25

- 추가 구현: 별점 없는 세 반응, 위치 방문 증명, 어뷰징 보류, 개인 매칭, 확인된 YouTube 방문 근거 계약과 합성 fixture.
- 새 문제 또는 막힘: YouTube 파생 신뢰점수 정책 위험, literal union 타입 오류 2건, 기존 의존성 패키지 맵 재구성 지연.
- 해결 또는 시도: 원본 구독자 수 정렬만 허용하고, 위험 신호 Set으로 타입을 수정했으며, lockfile 기반 의존성 복원 후 전체 게이트를 재실행했다.
- 검증 결과: 환경·lint·typecheck·2개 파일 16개 테스트·production build·390px/1440px 수동 검증 모두 통과했다.
- 현재 재개 지점: WU-03의 Supabase 연결 확인과 migration·RLS 설계.
