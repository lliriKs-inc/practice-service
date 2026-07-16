# Production release checklist

Use this together with the [deployment runbook](runbooks/deployment.md) and [staging acceptance checklist](runbooks/staging-acceptance.md). Every box requires evidence from the target release environment; local rehearsal alone is not sufficient.

## Before deployment

- [ ] A-08, B-07 and F-06 are merged; feature freeze is active.
- [ ] Backend PostgreSQL tests, typecheck, build and Prisma validation are green.
- [ ] Frontend lint, typecheck, unit tests and production build are green.
- [ ] Production dependency audit and image build checks are green.
- [ ] `docker compose ... config --quiet` succeeds with the reviewed env file.
- [ ] Current PostgreSQL/uploads backup is verified and copied off host.
- [ ] Migration and rollback compatibility are reviewed.
- [ ] Load/resilience thresholds are met in staging.
- [ ] Admin and student acceptance owners have completed their guide-based demo flows.

## Deployment

- [ ] Production images are built from the release commit.
- [ ] Migration service exits `0` before backend starts.
- [ ] PostgreSQL, backend and frontend report healthy.
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
