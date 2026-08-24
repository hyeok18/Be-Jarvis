const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 8000;
const ROOT = __dirname;

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`.env 파일을 찾을 수 없습니다: ${filePath}`);
  }

  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;

    const separator = line.indexOf('=');
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // 프로젝트의 .env를 명시적으로 사용합니다. 부모 프로세스에 남아 있는
    // 오래된 OPENAI_API_KEY가 있더라도 요청에 섞이지 않도록 덮어씁니다.
    if (name) process.env[name] = value;
  }
}

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 25_000) {
        reject(new Error('요청 본문이 너무 큽니다.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('JSON 형식이 올바르지 않습니다.'));
      }
    });
    request.on('error', reject);
  });
}

function getAssistantText(apiResponse) {
  return (apiResponse.output || [])
    .flatMap(item => item.content || [])
    .filter(content => content.type === 'output_text')
    .map(content => content.text)
    .join('\n')
    .trim();
}

loadDotEnv(path.join(ROOT, '.env'));
const rawApiKey = process.env.OPENAI_API_KEY || process.env.OPNEAI_API_KEY;
const apiKey = rawApiKey?.replace(/\s/g, '');
if (!apiKey) throw new Error('.env에 OPENAI_API_KEY를 설정해 주세요.');

const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'));

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': indexHtml.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
      });
      response.end(indexHtml);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const body = await readJson(request);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        sendJson(response, 400, { error: '메시지를 입력해 주세요.' });
        return;
      }
      if (message.length > 10_000) {
        sendJson(response, 400, { error: '메시지는 10,000자 이하여야 합니다.' });
        return;
      }

      const apiRequest = {
        model: 'gpt-5.6-luna',
        instructions: '철학적이고 따뜻한 말투를 사용한다. 사용자가 오늘 하루를 천천히 돌아볼 수 있도록 공감하며 답하고, 필요할 때는 부담 없는 성찰 질문을 하나 덧붙인다.',
        input: message,
        reasoning: { effort: 'low' },
        store: true
      };
      if (typeof body.previous_response_id === 'string' && body.previous_response_id) {
        apiRequest.previous_response_id = body.previous_response_id;
      }

      const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiRequest)
      });
      const apiResponse = await openAIResponse.json();

      if (!openAIResponse.ok) {
        // Upstream 오류 원문에는 마스킹된 키 등 민감한 정보가 포함될 수 있으므로 절대 전달하지 않습니다.
        sendJson(response, 502, { error: 'AI 서비스 인증에 실패했습니다. 서버의 API 키 설정을 확인해 주세요.' });
        return;
      }

      sendJson(response, 200, {
        answer: getAssistantText(apiResponse) || '응답 텍스트가 없습니다.',
        response_id: apiResponse.id
      });
      return;
    }

    sendJson(response, 404, { error: '요청한 경로를 찾을 수 없습니다.' });
  } catch (error) {
    if (!response.headersSent) {
      // 예외 원문은 경로, 환경 정보 또는 인증 관련 정보를 포함할 수 있으므로 외부에 노출하지 않습니다.
      sendJson(response, 500, { error: '서버 오류가 발생했습니다.' });
    } else {
      response.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
