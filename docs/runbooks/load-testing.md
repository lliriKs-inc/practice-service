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

Authenticated read models can be measured by setting `LOAD_BEARER_TOKEN` and a comma-separated `LOAD_PATHS`, for example the weekly progress and admin overview endpoints with prepared IDs/query parameters.

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

The run stayed below the 750 ms p95 and 1% error-rate operational thresholds. Authenticated aggregate reads must be measured again in the target staging infrastructure because network, proxy and database sizing differ from the local rehearsal.
