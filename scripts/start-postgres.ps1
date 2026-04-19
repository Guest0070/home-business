$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$PgCtl = Join-Path $Root 'tools\pgsql\bin\pg_ctl.exe'
$PgReady = Join-Path $Root 'tools\pgsql\bin\pg_isready.exe'
$DataDir = Join-Path $Root 'runtime\postgres-data'
$LogFile = Join-Path $Root 'runtime\postgres.log'

if (!(Test-Path $PgCtl)) {
  throw "PostgreSQL binaries not found at $PgCtl"
}

if (!(Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
  throw "PostgreSQL data directory is not initialized at $DataDir"
}

& $PgCtl -D $DataDir -l $LogFile -o '-p 5432' start
Start-Sleep -Seconds 2
& $PgReady -h 127.0.0.1 -p 5432 -U postgres

