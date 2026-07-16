# Production deployment runbook

## Preconditions

- Docker Engine with Compose v2;
- DNS/TLS reverse proxy already routes the public frontend and API origins;
- a reviewed `deploy/.env.production` created from `.env.production.example`;
- an off-host backup completed before upgrade;
- the release commit has green backend, frontend and production-container CI checks.

Never commit the production env file. `DATABASE_URL` must use the internal host `postgres`. `NEXT_PUBLIC_API_URL` is embedded during the frontend image build and must be the public API URL ending in `/api/v1`.

## Deploy

```powershell
Copy-Item deploy/.env.production.example deploy/.env.production
# Replace every placeholder and review origins, proxy hops and retention settings.

docker compose --env-file deploy/.env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml build --pull
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml up -d
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml ps
```

The `migrations` service must exit with code `0` before backend startup. PostgreSQL is not published to the host. Backend starts from compiled JavaScript as UID/GID `10001`; frontend starts with `next start` as the same non-root UID.

## Smoke verification

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/ready
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```

Then execute the candidate/practice/admin checklist in `docs/e2e-api-checklist.md` and the target-environment steps in `docs/runbooks/staging-acceptance.md`. Verify a protected report download, one audit log event and persistence after `docker compose restart backend postgres`.

## Rollback

1. Do not roll back the database blindly after a forward migration.
2. Stop frontend/backend, retain PostgreSQL and uploads volumes.
3. Redeploy the previous application image only if its schema is forward-compatible.
4. If the migration is incompatible, follow `backup-restore.md` using the pre-release backup.
5. Record release ID, migration ID, backup ID and incident timeline.
