$ErrorActionPreference = 'SilentlyContinue'

$apiPid = (Get-NetTCPConnection -LocalPort 4000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess)
if ($apiPid) { Stop-Process -Id $apiPid -Force }

$uiPid = (Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess)
if ($uiPid) { Stop-Process -Id $uiPid -Force }

& (Join-Path $PSScriptRoot 'stop-postgres.ps1')

Write-Host 'Coal TMS stopped.'

