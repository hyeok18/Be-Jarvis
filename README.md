# 반응과 크리에이터 근거로 보는 맛집 지도

별점과 종합평점 없이 `좋아요`, `그냥 그래요`, `싫어요` 세 반응으로 식당을 살펴보는 성수동 지도 프로젝트입니다. 공개 반응과 별도로 나와의 매칭도를 제공하고, 맛집 탐방 크리에이터가 영상에서 소개한 식당을 개별 YouTube 출처와 함께 지도에 표시합니다.

## 핵심 원칙

- 세 반응을 하나의 별점이나 종합점수로 바꾸지 않습니다.
- 방문 증명 없는 반응은 개인 취향에만 사용하고 공개 집계에 넣지 않습니다.
- 위치 체크인은 원본 좌표를 저장하지 않으며 실제 식사를 보장한다고 표현하지 않습니다.
- 의심 반응은 삭제·단정하지 않고 공개 집계에서 보류합니다.
- YouTube 페이지를 scraping하지 않고 공식 Data API만 사용합니다.
- 구독자 수는 최신 API 원값으로 표시·정렬할 뿐 자체 신뢰점수로 변환하지 않습니다.

## 현재 상태

- WU-01 Next.js 앱 셸과 품질 게이트 완료
- WU-02 구 별점 도메인 계약 완료 — 역사 기록이며 WU-20으로 대체
- WU-20 별점 폐지·반응·방문·크리에이터 계약 재설계 완료
- WU-03 Supabase 반응·방문·크리에이터 schema와 RLS 완료
- WU-04 식당·반응·크리에이터 합성 seed 완료
- WU-05 counted-only 집계·방문 검증·moderation 엔진 완료
- WU-06 공개 지도 셸과 mock 반응·매칭 UI 완료
- WU-07 Kakao 지도·필터·크리에이터 레이어·fallback 완료
- WU-08 식당 상세·한 탭 반응·개별 영상 근거 UI 완료
- WU-12 YouTube Data API 증분 동기화·stale 처리 완료
- WU-14 YouTube Cron·인증·동시 실행 방지 완료
- WU-13 관리자 후보 확인·sync log 코드와 UI 완료 — 실제 관리자 권한·후보 1건 검증 대기
- 진행 중: WU-09 Auth·반응 생성·변경 백엔드와 WU-08 UI 연결

## 로컬 실행과 품질 검사

Node.js 20.9 이상과 pnpm 11을 사용합니다.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

앱 셸은 외부 서비스 값 없이 실행됩니다. Supabase·Kakao·YouTube 연결 값은 `.env.local` 또는 Vercel 환경변수에만 저장합니다.

```powershell
pnpm run check:env
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run test:db
pnpm run build
```

`test:db`는 Docker가 실행 중인 로컬 Supabase 환경을 사용합니다. 원격 DB에는
`supabase/migrations/`와 동일한 migration만 적용하고, 테스트 fixture는 트랜잭션에서 롤백합니다.

## 구현 전 읽을 문서

1. [AGENTS.md](AGENTS.md) — 세션 운영, 안전 불변조건, 개발일지 규칙
2. [PRD.md](PRD.md) — 최종 제품·반응·방문·크리에이터 계약
3. [docs/VISION_ROADMAP.md](docs/VISION_ROADMAP.md) — P0/P1/P2 경계
4. [docs/DEVELOPMENT_PRIORITY.md](docs/DEVELOPMENT_PRIORITY.md) — 작업 단위와 현재 재개 지점
5. [docs/development-logs/INDEX.md](docs/development-logs/INDEX.md) — 최신 상태와 인계
6. [docs/TEAM_GIT_GUIDE.md](docs/TEAM_GIT_GUIDE.md) — 팀 Git·배포 협업

이전 Be-Jarvis 프로젝트는 `archive/be-jarvis-legacy-2026-08-25` 브랜치에 보존되어 있습니다. WU-00~WU-02 개발일지는 제품 의사결정 이력으로 유지합니다.
