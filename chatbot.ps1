$ErrorActionPreference = "Stop"

function Import-DotEnv {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw ".env 파일을 찾을 수 없습니다: $Path"
    }

    foreach ($rawLine in Get-Content -LiteralPath $Path) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            continue
        }

        $name, $value = $line.Split("=", 2)
        $name = $name.Trim()
        $value = $value.Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if ($name) {
            Set-Item -Path "Env:$name" -Value $value
        }
    }
}

function Get-AssistantText {
    param($Response)

    $parts = foreach ($item in $Response.output) {
        foreach ($content in $item.content) {
            if ($content.type -eq "output_text") {
                $content.text
            }
        }
    }

    return ($parts -join "`n").Trim()
}

Import-DotEnv -Path (Join-Path $PSScriptRoot ".env")

# 기존 .env의 키 이름 오타도 호환합니다.
$apiKey = $env:OPENAI_API_KEY
if (-not $apiKey) {
    $apiKey = $env:OPNEAI_API_KEY
}
if (-not $apiKey) {
    throw ".env에 OPENAI_API_KEY를 설정해 주세요."
}

$headers = @{
    Authorization  = "Bearer $apiKey"
    "Content-Type" = "application/json"
}
$previousResponseId = $null
$systemInstructions = "사무적 말투로 정확한 논리로만 대답"

Write-Host "GPT-5.6 Luna 챗봇입니다. 종료하려면 exit를 입력하세요."

while ($true) {
    $userInput = Read-Host "나"
    if ($userInput.Trim().ToLowerInvariant() -in @("exit", "quit")) {
        break
    }
    if (-not $userInput.Trim()) {
        continue
    }

    $request = @{
        model        = "gpt-5.6-luna"
        instructions = $systemInstructions
        input        = $userInput
        reasoning    = @{ effort = "low" }
        store        = $true
    }
    if ($previousResponseId) {
        $request.previous_response_id = $previousResponseId
    }

    try {
        $response = Invoke-RestMethod `
            -Method Post `
            -Uri "https://api.openai.com/v1/responses" `
            -Headers $headers `
            -Body ($request | ConvertTo-Json -Depth 5)

        $answer = Get-AssistantText -Response $response
        if (-not $answer) {
            $answer = "응답 텍스트가 없습니다."
        }

        Write-Host "AI: $answer"
        $previousResponseId = $response.id
    }
    catch {
        Write-Host "오류: $($_.Exception.Message)" -ForegroundColor Red
    }
}

