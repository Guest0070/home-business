$ErrorActionPreference = 'SilentlyContinue'

$Node = 'C:\Program Files\nodejs\node.exe'
if (!(Test-Path $Node)) {
  $Node = 'node'
}

& $Node (Join-Path $PSScriptRoot 'stop-app.mjs') | Out-Null

Write-Host 'Hosted backend stopped.'
