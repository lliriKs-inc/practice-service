# Backup and restore runbook

Backups must include both PostgreSQL and the `uploads_data` volume because database metadata and physical files form one logical dataset.

## Backup

```powershell
.\ops\backup.ps1 -EnvFile deploy/.env.production
```

The command creates a timestamped ignored directory under `backups/` containing `database.dump`, `uploads/` and SHA-256 checksums in `manifest.json`. Copy the completed directory to encrypted off-host storage.

Recommended MVP retention: daily backups for 30 days and weekly backups for 12 weeks. Access is limited to release operators. Test one restore at least monthly and before any migration-bearing release.

## Restore rehearsal

Always rehearse against a separate Compose project/env file first. The restore command is intentionally blocked without explicit confirmation.

```powershell
.\ops\restore.ps1 `
  -BackupDirectory backups\YYYYMMDD-HHMMSS `
  -EnvFile deploy/.env.production.rehearsal `
  -ConfirmRestore
```

After restore:

- `/ready` reports database `ok`;
- user/application/report counts match the source;
- sampled files match manifest checksums and download successfully;
- production E2E smoke passes;
- restart preserves both database and uploads.

Never restore directly over production without an incident/change record and a verified off-host copy of the current state.
