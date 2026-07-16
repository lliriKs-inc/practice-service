[CmdletBinding()]
param(
  [string]$EnvFile = "deploy/.env.production",
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$Destination = "backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Production env file not found: $EnvFile"
}

function Invoke-DockerCompose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker compose --env-file $EnvFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed: $($Arguments -join ' ')"
  }
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$backupDirectory = Join-Path $Destination $timestamp
$uploadsDirectory = Join-Path $backupDirectory "uploads"
$databaseDump = Join-Path $backupDirectory "database.dump"
$containerDump = "/tmp/practice-$timestamp.dump"

New-Item -ItemType Directory -Path $uploadsDirectory -Force | Out-Null

Invoke-DockerCompose exec -T postgres sh -c "PGPASSWORD=`"`$POSTGRES_PASSWORD`" pg_dump -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -Fc -f '$containerDump'"
Invoke-DockerCompose cp "postgres:$containerDump" $databaseDump
Invoke-DockerCompose exec -T postgres rm -f $containerDump
Invoke-DockerCompose cp "backend:/app/uploads/." $uploadsDirectory

$uploadFiles = Get-ChildItem -LiteralPath $uploadsDirectory -File -Recurse
$resolvedBackupDirectory = (Resolve-Path -LiteralPath $backupDirectory).Path.TrimEnd("\", "/")
$manifest = [ordered]@{
  createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  database = [ordered]@{
    file = "database.dump"
    sha256 = (Get-FileHash -LiteralPath $databaseDump -Algorithm SHA256).Hash
  }
  uploads = @($uploadFiles | ForEach-Object {
    [ordered]@{
      file = $_.FullName.Substring($resolvedBackupDirectory.Length).TrimStart("\", "/")
      sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
  })
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDirectory "manifest.json") -Encoding UTF8
Write-Output "Backup created: $backupDirectory"
