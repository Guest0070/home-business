$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Runtime = Join-Path $Root 'runtime'
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$Node = 'C:\Program Files\nodejs\node.exe'

if (!(Test-Path $Node)) {
  $Node = 'node'
}

New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

& (Join-Path $PSScriptRoot 'start-postgres.ps1')
$LaunchScript = Join-Path $PSScriptRoot 'launch-app.mjs'
& $Node $LaunchScript dev | Out-Null

Write-Host 'Coal TMS is starting.'
Write-Host 'Frontend: http://127.0.0.1:5173'
Write-Host 'Backend:  http://127.0.0.1:4000'
Write-Host 'Logs:     runtime\backend.out.log, runtime\frontend.out.log'
