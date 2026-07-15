# B-08 release rehearsal evidence

Date: 15.07.2026  
Branch: `release/b-production-hardening`  
Environment: Docker Desktop, Node.js 22 images, PostgreSQL 16 Alpine

## Automated quality gates

- Backend clean database: all 6 migrations applied with `prisma migrate deploy`.
- Backend PostgreSQL suite: 54/54 files and 285/285 tests passed.
- Backend typecheck, build, Prisma validation and diff check passed.
- Frontend: typecheck passed, 64/64 unit tests passed and 15-route production build passed.
- Frontend lint completed with 0 errors and 63 accepted baseline warnings in raw API adapters/hooks.
- Production dependency audit found no high or critical vulnerabilities. Current upstream trees report moderate advisories in Prisma development tooling and Next.js/PostCSS; forced breaking downgrades were not applied and must be monitored for upstream fixes.

## Container rehearsal

- `docker-compose.prod.yml` validation and all three image targets completed.
- Migration container exited with code `0` before backend startup.
- Backend `/health` returned `ok`; `/ready` returned `ready`; frontend returned HTTP 200.
- Backend and frontend runtime UID: `10001`.
- PostgreSQL was not published to a host port.
- Backend and PostgreSQL restart recovered readiness.
- A marker in `/app/uploads` remained present after backend restart.

## Backup and restore rehearsal

- Backup produced a PostgreSQL custom-format dump, uploads copy and SHA-256 manifest.
- A database marker row (`808`) and file marker (`restored-file`) were deleted after backup.
- `ops/restore.ps1` verified checksums, recreated the database, restored uploads and exited with code `0`.
- Both markers were present after restore and `/ready` returned `ready`.
- Rehearsal containers, volumes, temporary env and local backup artifacts were removed afterward.

## Load result

Operational smoke: 200 requests, concurrency 10, `/health` + `/ready`, 0 errors, p50 5.35 ms, p95 20.48 ms, p99 23.08 ms. Authenticated aggregate reads remain a staging gate because local measurements do not represent reverse proxy/network/production database sizing.

## Known follow-ups

- Replace remaining frontend raw-response `any` adapters with generated or explicit contract DTOs.
- Resolve the React hook dependency and unused helper warnings in frontend.
- Re-run dependency audit before release and remove moderate exceptions when non-breaking upstream versions are available.
- Observe the `pg` concurrent-query deprecation warning before upgrading to pg 9.
