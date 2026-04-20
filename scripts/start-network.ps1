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

$apiPid = (Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)
if ($apiPid) { Stop-Process -Id $apiPid -Force }
$uiPid = (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)
if ($uiPid) { Stop-Process -Id $uiPid -Force }

Start-Process -FilePath $Node `
  -ArgumentList 'src/server.js' `
  -WorkingDirectory $Backend `
  -RedirectStandardOutput (Join-Path $Runtime 'backend.out.log') `
  -RedirectStandardError (Join-Path $Runtime 'backend.err.log') `
  -WindowStyle Hidden

Start-Sleep -Seconds 3

Start-Process -FilePath $Node `
  -ArgumentList '.\node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5173' `
  -WorkingDirectory $Frontend `
  -RedirectStandardOutput (Join-Path $Runtime 'frontend.out.log') `
  -RedirectStandardError (Join-Path $Runtime 'frontend.err.log') `
  -WindowStyle Hidden

Start-Sleep -Seconds 4

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host 'Coal TMS network mode is starting.'
Write-Host "Frontend: http://$ip`:5173"
Write-Host "Backend:  http://$ip`:4000"
Write-Host 'Logs:     runtime\backend.out.log, runtime\frontend.out.log'
Write-Host 'If another device cannot connect, allow ports 5173 and 4000 through Windows Firewall.'

