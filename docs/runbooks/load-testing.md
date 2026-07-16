# Load and resilience testing

Run load checks only against an isolated test/staging environment. The default scenario targets operational endpoints and stops after 2,000 requests.

```powershell
cd backend
$env:LOAD_BASE_URL='http://localhost:3001'
$env:LOAD_CONCURRENCY='10'
$env:LOAD_DURATION_SECONDS='10'
$env:LOAD_MAX_P95_MS='750'
$env:LOAD_MAX_ERROR_RATE='0.01'
npm.cmd run load:smoke
```

Use the built-in authenticated scenarios against prepared staging data. Tokens are read only from environment variables and are not printed in the summary:

```powershell
# Cohort progress, missed days, overview and document list
$env:LOAD_SCENARIO='admin-reads'
$env:LOAD_COHORT_ID='<cohort-id>'
$env:LOAD_ADMIN_BEARER_TOKEN='<temporary-admin-jwt>'
$env:LOAD_MAX_P95_MS='1500'
npm.cmd run load:smoke

# Weekly tasks, readiness, document and report read models
$env:LOAD_SCENARIO='student-reads'
$env:LOAD_APPLICATION_ID='<application-id>'
$env:LOAD_STUDENT_BEARER_TOKEN='<temporary-student-jwt>'
$env:LOAD_WEEK_START='2026-07-13' # optional
npm.cmd run load:smoke
```

`LOAD_PATHS` plus `LOAD_BEARER_TOKEN` remains available for custom GET-only paths. Do not load-test upload or document-generation mutations: run their single-pass staging checks from `staging-acceptance.md` with disposable data instead.

Release thresholds for MVP:

- error rate ≤ 1%;
- p95 ≤ 750 ms for health/readiness and ≤ 1,500 ms for authenticated aggregate reads;
- no duplicate applications under concurrent submit;
- no duplicate daily tasks under concurrent approve;
- storage/SMTP failures do not leave a successful database response with missing metadata.

The concurrent write invariants run automatically in `release-resilience.integration.test.ts`. Storage rollback and SMTP failure behavior remain covered by their unit suites. Record environment, commit, concurrency, request count, p50/p95/p99, errors and bottlenecks for every release rehearsal.

## B-08 rehearsal result

Local production Compose rehearsal on 15.07.2026, branch `release/b-production-hardening`, Node 22 runtime, PostgreSQL 16:

| Requests | Concurrency | Paths | p50 | p95 | p99 | Errors |
|---:|---:|---|---:|---:|---:|---:|
| 200 | 10 | `/health`, `/ready` | 5.35 ms | 20.48 ms | 23.08 ms | 0% |

The run stayed below the 750 ms p95 and 1% error-rate operational thresholds. Authenticated aggregate reads are still unchecked externally and must be measured in the target staging infrastructure because network, proxy and database sizing differ from the local rehearsal.

Follow-up production-image smoke on 16.07.2026: 200 requests at concurrency 10 against `/health` and `/ready`, 0 errors, p50 5.15 ms, p95 16.95 ms and p99 26.95 ms. This does not replace the authenticated `admin-reads` and `student-reads` staging scenarios above.
