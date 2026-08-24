# 초간단 OpenAI 챗봇

Node.js 내장 HTTP 서버와 OpenAI Responses API를 사용하는 웹 UI 챗봇입니다.

## 설정

`.env` 파일에 API 키를 입력합니다.

```env
OPENAI_API_KEY=sk-your-api-key-here
```

현재 `.env`에 있는 `OPNEAI_API_KEY`도 호환되지만, 표준 이름인
`OPENAI_API_KEY` 사용을 권장합니다.

API 키는 Node.js 서버에서만 읽습니다. 브라우저 UI에는 키를 전달하지 않으며,
`.gitignore`에 `.env`를 등록해 저장소 커밋도 방지합니다.

## 웹 서버 실행

```powershell
powershell -ExecutionPolicy Bypass -File .\start-server.ps1
```

브라우저에서 <http://localhost:8000>을 엽니다. 서버를 종료하려면 실행한
터미널에서 `Ctrl+C`를 누릅니다.

별도 npm 패키지 설치는 필요하지 않습니다. 기존 터미널 버전은 다음과 같이
실행할 수 있습니다.

프로젝트에는 Node.js v26.7.0 포터블 런타임이 포함되어 있으며,
`start-server.ps1`가 이를 우선 사용합니다.

```powershell
pwsh -File .\chatbot.ps1
```

## 고정 설정

- 모델: `gpt-5.6-luna`
- 시스템 지침: `철학적이고 따뜻한 말투를 사용`
- 목적: 사용자가 오늘 하루를 돌아볼 수 있도록 공감하고 성찰 질문을 이어감
- 이전 응답 ID를 연결하여 대화 문맥을 유지합니다.
