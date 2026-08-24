$ErrorActionPreference = "Stop"

$localNodePath = Join-Path $PSScriptRoot "tools\node-v26.7.0-win-x64\node.exe"
$node = Get-Command node -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $localNodePath) {
    $nodePath = $localNodePath
}
elseif ($node) {
    $nodePath = $node.Source
}
else {
    $nodePath = "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}

if (-not (Test-Path -LiteralPath $nodePath)) {
    throw "Node.js를 찾을 수 없습니다. Node.js 18 이상을 설치해 주세요."
}

& $nodePath (Join-Path $PSScriptRoot "server.js")
