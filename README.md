# 맛집 리뷰 신뢰도 지도

광고성·협찬성 리뷰가 맛집 평점을 왜곡하는 문제를 줄이기 위한 24시간 해커톤 프로젝트입니다.

이 서비스는 리뷰를 무조건 삭제하거나 조작 여부를 단정하지 않습니다. 고평점 급증, 문장 유사도, 리뷰어 평점 분포 등 여러 신호로 리뷰 신뢰도를 계산하고, 맛 점수와 종합점수 및 계산 근거를 함께 보여주는 것을 목표로 합니다.

## 현재 상태

- 요구사항 심층 인터뷰 완료
- 24시간 MVP 범위와 수용 기준 확정
- WU-01 Next.js 앱 셸과 품질 게이트 완료
- 다음 작업: WU-02 도메인 타입·알고리즘 설정·mock 계약

## 로컬 실행과 품질 검사

Node.js 20.9 이상과 pnpm 11을 사용합니다.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

현재 앱 셸은 외부 서비스 값 없이 실행됩니다. 후속 작업에서 Supabase·Kakao·OpenAI를 연결할 때는 `.env.example`의 이름을 유지하고 실제 값은 `.env.local` 또는 Vercel 환경변수에만 저장합니다.

```powershell
pnpm run check:env
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

구현 전 다음 문서를 순서대로 확인합니다.

1. [AGENTS.md](AGENTS.md) — 세션 운영, 완료 게이트, 개발일지 규칙
2. [PRD.md](PRD.md) — 최종 구현 계약과 수용 기준
3. [docs/DEVELOPMENT_PRIORITY.md](docs/DEVELOPMENT_PRIORITY.md) — 작업 단위, 의존성, 현재 재개 지점
4. [docs/development-logs/INDEX.md](docs/development-logs/INDEX.md) — 최신 작업 상태와 세션 인계
5. [docs/TEAM_GIT_GUIDE.md](docs/TEAM_GIT_GUIDE.md) — 4인 팀 Git·배포·AI 협업 가이드
6. [docs/PROJECT_CONCEPT.md](docs/PROJECT_CONCEPT.md) — 인터뷰 전 초기 아이디어

## 저장소 이력

이 저장소의 이전 Be-Jarvis 프로젝트는 `archive/be-jarvis-legacy-2026-08-25` 브랜치에 보존되어 있습니다.
