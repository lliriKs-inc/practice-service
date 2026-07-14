# Documents API

## Readiness

`GET /api/applications/me/documents` returns readiness for `INDIVIDUAL_TASK`, `TITLE_PAGE`, `REVIEW`, and `NOTICE`.

Each document includes `ready`, `missingFields`, and `requiresApprovedReport`.

## EAV autosave

`PUT /api/applications/me/documents/:type/fields`

```json
{ "field": "review_grade", "value": "A" }
```

Only the authenticated student's own application is updated.

## Report workflow

- `GET /api/applications/me/applications/:applicationId/report`
- `PUT /api/applications/me/applications/:applicationId/report`
- `PATCH /api/applications/cohorts/:cohortId/applications/:applicationId/report/status`

Report statuses are `PENDING`, `APPROVED`, and `REJECTED`. Replacing a report resets its status to `PENDING`.

Report responses expose safe metadata and a resource-based `downloadPath`; the underlying `file_url` is never returned. Protected downloads:

- `GET /me/applications/:applicationId/report/file` — owning student;
- `GET /cohorts/:cohortId/admin/applications/:applicationId/report/file` — ADMIN scoped to the cohort.

## DOCX generation

Supported templates: `individual-task`, `review`, `title-page`, and `notice`.

Templates are stored in `backend/templates/documents/` and generation returns a DOCX buffer.

Generation also stores the DOCX through `StorageService`, updates `Document.generated_file_url/generated_at`, and replaces the previous generated file. Stored documents are downloaded through:

- `GET /me/applications/:applicationId/documents/:type/file`;
- `GET /cohorts/:cohortId/admin/applications/:applicationId/documents/:type/file`.

The download endpoints resolve files from application/document resource IDs and never require clients to send a storage key.
