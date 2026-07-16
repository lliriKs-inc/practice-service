[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BackupDirectory,
  [string]$EnvFile = "deploy/.env.production",
  [string]$ComposeFile = "docker-compose.prod.yml",
  [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmRestore) {
  throw "Restore replaces the target database and uploads. Re-run with -ConfirmRestore."
}
if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Production env file not found: $EnvFile"
}

$databaseDump = Join-Path $BackupDirectory "database.dump"
$uploadsDirectory = Join-Path $BackupDirectory "uploads"
$manifestPath = Join-Path $BackupDirectory "manifest.json"

foreach ($requiredPath in @($databaseDump, $uploadsDirectory, $manifestPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Backup component not found: $requiredPath"
  }
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$actualDatabaseHash = (Get-FileHash -LiteralPath $databaseDump -Algorithm SHA256).Hash
if ($actualDatabaseHash -ne $manifest.database.sha256) {
  throw "Database dump checksum does not match manifest.json"
}

foreach ($upload in $manifest.uploads) {
  $uploadPath = Join-Path $BackupDirectory $upload.file
  if (
    -not (Test-Path -LiteralPath $uploadPath) -or
    (Get-FileHash -LiteralPath $uploadPath -Algorithm SHA256).Hash -ne $upload.sha256
  ) {
    throw "Upload checksum does not match: $($upload.file)"
  }
}

function Invoke-DockerCompose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker compose --env-file $EnvFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed: $($Arguments -join ' ')"
  }
}

$containerDump = "/tmp/practice-restore.dump"
Invoke-DockerCompose stop frontend backend
Invoke-DockerCompose cp $databaseDump "postgres:$containerDump"
Invoke-DockerCompose exec -T postgres sh -c "PGPASSWORD=`"`$POSTGRES_PASSWORD`" dropdb --force --if-exists -U `"`$POSTGRES_USER`" `"`$POSTGRES_DB`" && PGPASSWORD=`"`$POSTGRES_PASSWORD`" createdb -U `"`$POSTGRES_USER`" `"`$POSTGRES_DB`" && PGPASSWORD=`"`$POSTGRES_PASSWORD`" pg_restore -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" --clean --if-exists --no-owner '$containerDump'"
Invoke-DockerCompose exec -T postgres rm -f $containerDump
Invoke-DockerCompose start backend
Invoke-DockerCompose exec -T backend sh -c "find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +"
Invoke-DockerCompose cp "$uploadsDirectory/." "backend:/app/uploads"
Invoke-DockerCompose start frontend

Write-Output "Restore completed. Verify /health, /ready and the release smoke checklist."
