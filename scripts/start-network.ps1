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
& $Node $LaunchScript network | Out-Null

Start-Sleep -Seconds 4

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host 'Coal TMS network mode is starting.'
Write-Host "Frontend: http://$ip`:5173"
Write-Host "Backend:  http://$ip`:4000"
Write-Host 'Logs:     runtime\backend.out.log, runtime\frontend.out.log'
Write-Host 'If another device cannot connect, allow ports 5173 and 4000 through Windows Firewall.'
