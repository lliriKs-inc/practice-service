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

## DOCX generation

Supported templates: `individual-task`, `review`, `title-page`, and `notice`.

Templates are stored in `backend/templates/documents/` and generation returns a DOCX buffer.
