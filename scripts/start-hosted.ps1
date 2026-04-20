$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$runtime = Join-Path $root 'runtime'
$networkIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } |
  Select-Object -First 1 -ExpandProperty IPAddress)

New-Item -ItemType Directory -Force -Path $runtime | Out-Null

Write-Host 'Starting local PostgreSQL if available...'
& (Join-Path $PSScriptRoot 'start-postgres.ps1')

Write-Host 'Building frontend...'
Push-Location $frontend
& "C:\Program Files\nodejs\node.exe" .\node_modules\vite\bin\vite.js build
Pop-Location

Write-Host 'Restarting hosted backend...'
$LaunchScript = Join-Path $PSScriptRoot 'launch-app.mjs'
& "C:\Program Files\nodejs\node.exe" $LaunchScript hosted | Out-Null

Start-Sleep -Seconds 4

Write-Host ''
Write-Host 'Hosted mode is running.'
Write-Host 'Open locally: http://127.0.0.1:4000'
if ($networkIp) {
  Write-Host "Open on network: http://$networkIp`:4000"
}
