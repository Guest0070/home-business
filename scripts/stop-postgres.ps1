$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$PgCtl = Join-Path $Root 'tools\pgsql\bin\pg_ctl.exe'
$DataDir = Join-Path $Root 'runtime\postgres-data'

if (!(Test-Path $PgCtl)) {
  throw "PostgreSQL binaries not found at $PgCtl"
}

& $PgCtl -D $DataDir stop -m fast

