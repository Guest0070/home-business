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

Start-Process -FilePath $Node `
  -ArgumentList 'src/server.js' `
  -WorkingDirectory $Backend `
  -RedirectStandardOutput (Join-Path $Runtime 'backend.out.log') `
  -RedirectStandardError (Join-Path $Runtime 'backend.err.log') `
  -WindowStyle Hidden

Start-Sleep -Seconds 3

Start-Process -FilePath $Node `
  -ArgumentList '.\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173' `
  -WorkingDirectory $Frontend `
  -RedirectStandardOutput (Join-Path $Runtime 'frontend.out.log') `
  -RedirectStandardError (Join-Path $Runtime 'frontend.err.log') `
  -WindowStyle Hidden

Write-Host 'Coal TMS is starting.'
Write-Host 'Frontend: http://127.0.0.1:5173'
Write-Host 'Backend:  http://127.0.0.1:4000'
Write-Host 'Logs:     runtime\backend.out.log, runtime\frontend.out.log'

