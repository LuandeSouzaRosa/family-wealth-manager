$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$localBaseUrl = 'http://127.0.0.1:3001'
$localPort = 3001
$env:NEXT_PUBLIC_APP_URL = $localBaseUrl

Write-Host "[quick-add-proof] Using local base URL: $localBaseUrl"
Write-Host "[quick-add-proof] Starting local Next.js dev server..."

$devServer = Start-Process `
  -FilePath 'cmd.exe' `
  -ArgumentList '/c', "npm run dev -- --hostname 127.0.0.1 --port $localPort" `
  -WorkingDirectory $projectRoot `
  -PassThru `
  -WindowStyle Hidden

try {
  $isReady = $false
  for ($i = 0; $i -lt 120; $i++) {
    if ($devServer.HasExited) {
      throw '[quick-add-proof] Dev server exited before tests started.'
    }

    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri $localBaseUrl -TimeoutSec 2
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        $isReady = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $isReady) {
    throw '[quick-add-proof] Local dev server did not become ready in time.'
  }

  Write-Host '[quick-add-proof] Running desktop Quick Add proof...'
  npm run test:e2e -- tests/e2e/quick-add-desktop.spec.ts --project=chromium-desktop
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  Write-Host '[quick-add-proof] Running mobile Quick Add proof...'
  npm run test:e2e -- tests/e2e/quick-add-mobile.spec.ts --project=chromium-mobile
  exit $LASTEXITCODE
}
finally {
  if ($devServer -and -not $devServer.HasExited) {
    Stop-Process -Id $devServer.Id -Force
  }
}
