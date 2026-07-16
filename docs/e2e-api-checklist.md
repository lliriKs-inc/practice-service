# E2E API checklist

Чеклист проверяет frozen MVP contract через production `createApp()` и `/api/v1`. Он предназначен для backend regression, frontend acceptance и release rehearsal.

## 1. Preconditions

- PostgreSQL доступен по отдельному test `DATABASE_URL`.
- К test database применены все migration files.
- `JWT_SECRET` содержит не менее 32 символов.
- `UPLOAD_DIR` указывает на временный/test каталог.
- Тест не запускается против production database.

Подготовка:

```powershell
cd backend
npm install
npx.cmd prisma migrate deploy
npx.cmd prisma validate
```

Обычный suite без DB-интеграций:

```powershell
npm.cmd test
```

Полный backend E2E:

```powershell
$env:RUN_DB_INTEGRATION='true'
npm.cmd test
```

Основной production flow находится в `backend/src/test/b06-production-flow.integration.test.ts`. Fixtures используют уникальный prefix и удаляют созданные DB records и stored files после теста.

## 2. Operational smoke

| Check | Expected |
|---|---|
| `GET /` | `200`, `{ "status": "ok" }` |
| `GET /health` | `200`, process health metadata |
| `GET /ready` с доступной DB | `200` |
| `GET /ready` при failed readiness check | `503` common error response |
| Security headers | `X-Powered-By` отсутствует; Helmet headers присутствуют |
| Request ID | входной `X-Request-Id` отражается в error response либо создаётся сервером |

## 3. Candidate scenario

Выполнять на ACTIVE cohort с открытым application window, survey с required question, track, invitation и published test task.

1. `GET /api/v1/cohorts/public/current` без JWT → `200`.
2. `POST /api/v1/invitations/validate` с invitation token → `200`, `valid=true`.
3. `GET /api/v1/public/invitations/:token/form` без JWT → cohort, tracks, ordered questions; private user fields отсутствуют.
4. `POST /api/v1/auth/register` → `201`; password hash отсутствует.
5. `POST /api/v1/auth/login` → `200`, JWT.
6. `GET /api/v1/auth/me` с student JWT → `200`, role `STUDENT`.
7. `POST /api/v1/public/invitations/:token/applications` → `201`, status `PENDING`.
8. Повторная application на тот же track → `409`.
9. `GET /api/v1/me/applications` → только applications текущего пользователя.
10. `GET /api/v1/me/applications/:applicationId` → правильные track/cohort/answers.
11. `GET /api/v1/me/applications/:applicationId/test-task` → `available=true`.
12. `PUT /api/v1/me/applications/:applicationId/test-task-submission` multipart `file` → `200`.
13. Повторная загрузка заменяет файл и обновляет `submitted_at`.
14. ADMIN читает submission через cohort-scoped endpoint.
15. ADMIN переводит application в `APPROVED`.
16. Повторный approval → `200`, без второго календаря.
17. Student application detail показывает `APPROVED`.

## 4. Practice and documents scenario

Продолжить с approved application.

1. Проверить, что DailyTask созданы только между practice dates и только для weekdays.
2. `GET /api/v1/me/applications/:applicationId/tasks?weekStart=YYYY-MM-DD` → пять weekday cells.
3. `PUT /api/v1/me/daily-tasks/:taskId` с description и links → `200`, `saved_at` обновлён.
4. Повторное сохранение полностью заменяет links.
5. ADMIN читает `/cohorts/:cohortId/progress` и видит application.
   STUDENT с `APPROVED` application в этой когорте через explicit toggle видит всех approved участников; студент без участия не получает данные.
6. ADMIN читает `/cohorts/:cohortId/progress/missed`; future days не считаются пропусками.
7. Student заполняет required fields `INDIVIDUAL_TASK`, `TITLE_PAGE`, `NOTICE` через autosave.
8. ADMIN заполняет required fields `REVIEW` через admin autosave.
9. Student загружает report multipart field `report`; response не содержит storage key.
10. ADMIN переводит report в `APPROVED`.
11. Readiness показывает все четыре document types ready.
12. Сгенерировать `INDIVIDUAL_TASK`, `REVIEW`, `TITLE_PAGE`, `NOTICE` через `POST /me/applications/:applicationId/documents/:type/generate`; каждый ответ — DOCX attachment.
13. Readiness после generation показывает `generated=true` для всех четырёх types.
14. Student скачивает собственные report и generated document.
15. ADMIN скачивает те же resources через cohort-scoped paths.
16. Admin document list/detail возвращают EAV/readiness без storage keys.
17. Admin overview aggregates согласованы с application/report/document/task records.

## 5. RBAC, ownership и isolation

| Check | Expected |
|---|---|
| Private endpoint без JWT | `401` |
| Invalid JWT | `401` |
| STUDENT вызывает ADMIN endpoint | `403` |
| ADMIN-only survey mutation со STUDENT token | `403` |
| Student читает application другого user | `404` |
| Admin передаёт application из другой cohort | `404` |
| Track из другой cohort при invitation submit | `400 TRACK_COHORT_MISMATCH` |
| Question из другой survey | `400 QUESTION_COHORT_MISMATCH` |
| Admin file download с wrong cohort | `404` |
| Direct `/uploads/...` request | `404` |
| Старый unversioned business path | `404` |
| Unknown authenticated `/api/v1/...` | `404 ROUTE_NOT_FOUND` |

Проверить, что `active_cohort_id` не даёт доступ к resource другой cohort и не заменяет явную relation-based проверку.

## 6. Validation and status checks

- Invalid JSON → `400 INVALID_JSON`.
- Missing/invalid required body fields → `400`.
- Invalid `weekStart` → `400 VALIDATION_ERROR` либо `INVALID_WEEK_START` из domain parser.
- Duplicate daily task links → `400 VALIDATION_ERROR`.
- Rejection без `rejection_reason` → `400`.
- `APPROVED -> REJECTED` → `400 INVALID_STATUS_TRANSITION`.
- Publish test task второй раз → `409 TEST_TASK_ALREADY_PUBLISHED`.
- Generate document с missing fields → `400 DOCUMENT_NOT_READY`.
- Generate title page до approved report → `400 DOCUMENT_NOT_READY`.
- Wrong field owner → `403 DOCUMENT_FIELD_FORBIDDEN`.
- Invalid upload MIME/extension, empty file и oversized file → соответствующая upload policy error.

## 7. File security

Для report, task, submission и generated document проверить:

- response содержит `Content-Disposition: attachment`;
- `Cache-Control: private, no-store`;
- `X-Content-Type-Options: nosniff`;
- raw storage fields не появляются в JSON read models; task-file URL проверяется только как opaque protected `download_path`;
- replacement удаляет предыдущий physical file;
- missing и unauthorized resources не позволяют определить существование чужого файла;
- test cleanup удаляет созданные файлы из `UPLOAD_DIR`.

## 8. Contract automation map

| Область | Автоматическая проверка |
|---|---|
| Route inventory и `/api/v1` | `backend/src/routes/api-v1.routes.test.ts` |
| Central contract parity/JSON and executable HTTP errors | `backend/src/routes/api-contract.test.ts` |
| Candidate module flow | `backend/src/test/admissions.integration.test.ts` |
| Production admin setup + approve/reject candidate/practice flow | `backend/src/test/b06-production-flow.integration.test.ts` |
| Concurrent duplicate submit/approve resilience | `backend/src/test/release-resilience.integration.test.ts` |
| Progress PostgreSQL isolation | `backend/src/modules/tasks/daily-task-progress.integration.test.ts` |
| Admin PostgreSQL filters/isolation | `backend/src/modules/admin/admin.integration.test.ts` |
| Protected document files | document file route/service tests |
| Upload/storage policy | shared upload/storage tests |
| Production deploy/recovery gate | `docs/release-checklist.md` and `.github/workflows/production-ci.yml` |

## 9. Final acceptance gate

Перед merge B-07:

```powershell
cd backend
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npx.cmd prisma validate
cd ..
git diff --check
```

При доступной test DB обязательно выполнить suite с `RUN_DB_INTEGRATION=true`. Acceptance успешен, если route registry совпадает с центральным контрактом, оба E2E flows зелёные, отсутствует cross-cohort access и ни один JSON response не раскрывает private storage key.
