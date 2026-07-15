# Security operations runbook

## Secrets

- Generate JWT and database secrets with a cryptographically secure generator; placeholders and JWT values shorter than 32 characters are rejected.
- Store production secrets outside Git and restrict the env file to the deployment operator.
- Rotate SMTP/database credentials in their providers first, update the deployment secret store, then recreate services.
- JWT rotation invalidates existing sessions in the MVP. Schedule a maintenance window, deploy the new secret and require users to log in again.

## HTTP and containers

- Production CORS is an explicit comma-separated allowlist; wildcard is rejected.
- General, auth and multipart upload rate limits are independent.
- PostgreSQL has no published host port.
- Runtime containers drop Linux capabilities, use `no-new-privileges`, read-only root filesystems and non-root users.
- Uploaded files are available only through authorization policies, never `/uploads`.

## Audit and privacy

Security audit events are structured JSON logs. Forward them to access-controlled centralized storage. Recommended MVP retention is 90 days; local Docker logs rotate at 10 files × 10 MB and are not the compliance archive.

Reports, submissions and generated documents may contain personal data. Restrict backups/logs, encrypt off-host copies, avoid filenames/content in logs and delete files together with the corresponding retention-approved business record. A legal/data-owner decision must define the final retention period before public production use.

## Dependency and incident response

CI runs production dependency audits. High/critical findings block release unless a documented, time-bounded exception is approved. For an incident: isolate public traffic, preserve logs and backups, rotate affected secrets, restore only from verified media, and document the timeline and affected data.
