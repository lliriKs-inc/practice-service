# Production release checklist

Use this together with the [deployment runbook](runbooks/deployment.md) and [staging acceptance checklist](runbooks/staging-acceptance.md). Every box requires evidence from the target release environment; local rehearsal alone is not sufficient.

## Before deployment

- [x] A-08, B-07 and F-06 are merged.
- [x] Feature freeze is active for the current release and recorded by the release owner on 16.07.2026.
- [x] Backend unit tests, typecheck and build are green: 51 files, 286 passed, 15 skipped.
- [ ] Backend PostgreSQL integration tests are green; the latest local run did not enable `RUN_DB_INTEGRATION=true`.
- [x] Backend Prisma generate and validate are green.
- [x] Frontend unit tests are green: 12 files and 65 tests passed.
- [x] Frontend lint is green with 0 errors and 63 warnings.
- [x] Frontend typecheck and production build are green after moving stale `.next` generated route types.
- [x] Backend and frontend production dependency audits report no high/critical vulnerabilities.
- [x] Production image build is green on the user's machine.
- [x] Production Compose syntax passes `docker compose -f docker-compose.prod.yml config --quiet` with CI-equivalent variables.
- [x] The reviewed production env file passes `docker compose ... config --quiet` without exposing or committing secrets.
- [ ] Current PostgreSQL/uploads backup is verified and copied off host.
- [ ] Migration and rollback compatibility are reviewed.
- [ ] Load/resilience thresholds are met in staging.
- [ ] Admin and student acceptance owners have completed their guide-based demo flows.

## Deployment

- [ ] Production images are built from the release commit.
- [ ] Migration service exit code `0` is recorded before backend starts; the Compose output only shows that it exited.
- [ ] PostgreSQL, backend and frontend report healthy; PostgreSQL/backend were shown healthy, but frontend HTTP health was not separately recorded.
- [ ] `/health`, `/ready` and frontend root respond through the public proxy/TLS.
- [ ] Candidate, approve/reject, calendar, progress, report and four-document smoke passes.
- [ ] Cross-cohort and protected-file negative checks return the contract errors.
- [ ] Audit events arrive in centralized logs without secrets or file content.

## Recovery and handoff

- [ ] Restart rehearsal preserves PostgreSQL and uploads.
- [ ] Restore rehearsal from the release backup is documented.
- [ ] Release ID, image digests, migration ID and backup ID are recorded.
- [ ] Known limitations and operator contacts are published.
- [ ] Monitoring window is assigned before feature freeze is lifted.

## Local verification notes — 16.07.2026

The following checks were performed without starting the application or running the full business flow:

- [x] Required production files, CI workflows, Docker Compose files, backup scripts and runbooks exist.
- [x] `A-08`, `B-07` and `F-06` are present in the merged `main` history.
- [x] The legacy `backend/src/modules/cohort-role` module is absent from the current `HEAD`.
- [x] `docker compose -f docker-compose.prod.yml config --quiet` passes with CI-equivalent non-production values.
- [x] The release preflight is being performed on `codex/release-preflight-checks`; no unrelated generated files remain.
- [x] `git diff --check` passes.
- [x] A local reviewed release env file was created from `deploy/.env.production.example` with rehearsal-only credentials and remains ignored by Git.
- [x] npm dependency audit — no high/critical vulnerabilities; backend has 3 moderate advisories and frontend has 2 moderate advisories.
- [x] Production image build — completed on the user's machine; production images were listed.
- [x] Docker Compose pull/up — production-like stack was created; PostgreSQL/backend reported healthy and migrations exited.
- [ ] Migration container exit code — must be recorded explicitly with `docker inspect`.
- [x] Frontend typecheck/build — rerun after moving stale `.next`: both passed.
- [x] Backend quality gates — Prisma generate/validate, tests, typecheck and build passed.
- [x] Offline verification rerun on 17.07.2026: backend 51 files / 286 passed / 15 skipped; frontend 12 files / 65 passed; frontend typecheck/build passed; lint 0 errors / 63 warnings.
- [x] Offline Compose config and `git diff --check` passed.

These local checks do not satisfy the target-environment release gates. The remaining boxes must be completed with evidence from CI, staging or production as described in the full guide.
