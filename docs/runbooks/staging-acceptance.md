# Staging acceptance and demo

Run this only against an isolated staging environment with disposable test data. Never place JWTs in a committed file or command-line argument; set them in the current shell environment and clear them afterward.

## Prepared data

- ACTIVE cohort with practice dates and a published survey/track/test task;
- one administrator and one approved student application in that cohort;
- daily tasks, document fields and a report appropriate to the checks being run;
- release commit, image digests, migration ID and backup ID recorded in the release ticket.

## Automated read smoke

```powershell
cd backend
$env:STAGING_BASE_URL='https://api.staging.example'
$env:STAGING_COHORT_ID='<cohort-id>'
$env:STAGING_APPLICATION_ID='<application-id>'
$env:STAGING_ADMIN_BEARER_TOKEN='<temporary-admin-jwt>'
$env:STAGING_STUDENT_BEARER_TOKEN='<temporary-student-jwt>'
npm.cmd run release:staging-smoke
```

The base URL is the API origin without a trailing `/api/v1`; the script adds versioned paths. It verifies authenticated admin progress/overview/documents and student tasks/readiness/report metadata. Its output contains endpoint names, statuses and body sizes, never tokens.

Optional mutations are deliberately opt-in and must use disposable data. Report upload resets review status, so upload and document generation may need separate prepared applications or an administrator review between them.

```powershell
$env:STAGING_ALLOW_MUTATIONS='true'
$env:STAGING_REPORT_FILE='C:\temp\staging-report.pdf'
# Or, after fields/report are ready:
$env:STAGING_GENERATE_DOCUMENTS='INDIVIDUAL_TASK,REVIEW,TITLE_PAGE,NOTICE'
npm.cmd run release:staging-smoke
```

## Authenticated load reads

Run admin and student scenarios separately so their latency and failures remain attributable:

```powershell
$env:LOAD_BASE_URL=$env:STAGING_BASE_URL
$env:LOAD_SCENARIO='admin-reads'
$env:LOAD_COHORT_ID=$env:STAGING_COHORT_ID
$env:LOAD_ADMIN_BEARER_TOKEN=$env:STAGING_ADMIN_BEARER_TOKEN
$env:LOAD_MAX_P95_MS='1500'
npm.cmd run load:smoke

$env:LOAD_SCENARIO='student-reads'
$env:LOAD_APPLICATION_ID=$env:STAGING_APPLICATION_ID
$env:LOAD_STUDENT_BEARER_TOKEN=$env:STAGING_STUDENT_BEARER_TOKEN
npm.cmd run load:smoke
```

## Manual acceptance

- candidate registration, submission, duplicate protection and approve/reject;
- five-day calendar boundaries, save/replace links and missed-day behavior;
- report upload/review/download and generation/download of all four documents;
- wrong role, wrong cohort, foreign application and direct upload-path negative checks;
- public TLS/proxy health, audit log delivery, restart persistence and monitored rollback window;
- administrator and student demo flows using [the admin guide](../admin-guide.md) and [the student guide](../user-guide.md).

Record timestamps, release ID, scenario summaries, screenshots/log references, failures and approver. Do not mark the production release checklist complete from a local run.

Afterward clear the token variables and remove disposable uploaded files:

```powershell
Remove-Item Env:STAGING_ADMIN_BEARER_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:STAGING_STUDENT_BEARER_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:LOAD_ADMIN_BEARER_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:LOAD_STUDENT_BEARER_TOKEN -ErrorAction SilentlyContinue
```
