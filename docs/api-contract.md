# API Contract сервиса «Практика»

Статус: frozen MVP contract после B-06. Этот файл является центральным источником истины для frontend и интеграционных тестов. Fragment-документы в `docs/api/` содержат дополнительный контекст, но при расхождении приоритет имеет этот контракт и production registry.

## 1. Общие соглашения

- Business API base path: `/api/v1`.
- Operational endpoints `/`, `/health`, `/ready` не имеют version prefix.
- JSON request: `Content-Type: application/json`.
- Private request: `Authorization: Bearer <jwt>`.
- `X-Cohort-Id` используется только там, где endpoint явно требует cohort context без `:cohortId` в пути.
- Даты и время возвращаются как ISO 8601 UTC; `weekStart` передаётся как `YYYY-MM-DD`.
- List endpoints в текущем MVP возвращают полный массив и не поддерживают pagination.
- Имена полей response сохраняют фактический формат endpoint: Prisma-oriented ответы используют `snake_case`, специальные read models — `camelCase`.
- `downloadPath` и `download_path` являются API-relative путями. Клиент добавляет `/api/v1` перед таким путём.
- Raw storage fields и абсолютные filesystem paths не являются частью публичного контракта. Task-file `download_path` является opaque protected URL и может содержать category/file identifier; клиент не должен разбирать или сохранять его части.

### Общий error envelope

Большинство validation/domain ошибок возвращает:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": null,
  "requestId": "request-id"
}
```

JWT middleware использует `AUTH_TOKEN_MISSING`, `AUTH_TOKEN_INVALID_FORMAT` и `AUTH_TOKEN_INVALID` с HTTP `401`. Проверка роли возвращает `INSUFFICIENT_PERMISSIONS` с HTTP `403`. Неизвестный versioned route после успешной аутентификации возвращает `ROUTE_NOT_FOUND` с HTTP `404`.

`POST /auth/register`, `POST /auth/login` и `GET /auth/me` используют тот же error envelope. Auth-specific codes: `USER_ALREADY_EXISTS`, `INVALID_CREDENTIALS` и `USER_NOT_FOUND`.

### Cohort и resource authorization

`active_cohort_id` является UI preference и не используется как самостоятельное доказательство доступа. Cohort определяется invitation token, явным `:cohortId`, `X-Cohort-Id` или серверной связью ресурса. Student endpoints проверяют владельца application. Admin endpoints с `:cohortId` ограничивают данные через `Application -> Track -> Cohort` либо `Track -> Cohort`.

## 2. Полный route inventory

Таблица ниже автоматически сверяется с `listRegisteredApiRoutes()`.

<!-- ROUTE_INVENTORY_START -->
| Method | Path | Access | Success | Назначение |
|---|---|---|---:|---|
| POST | `/api/v1/auth/login` | Public | 200 | Получить JWT |
| GET | `/api/v1/auth/me` | Authenticated | 200 | Профиль текущего пользователя |
| POST | `/api/v1/auth/register` | Public | 201 | Зарегистрировать student account |
| POST | `/api/v1/cohorts` | ADMIN | 201 | Создать cohort |
| GET | `/api/v1/cohorts/:cohortId/admin/applications` | ADMIN | 200 | Admin application list/read model |
| GET | `/api/v1/cohorts/:cohortId/admin/applications/:applicationId` | ADMIN | 200 | Admin application detail |
| PUT | `/api/v1/cohorts/:cohortId/admin/applications/:applicationId/documents/:type/fields/:fieldKey` | ADMIN | 200 | Autosave admin-owned document field |
| GET | `/api/v1/cohorts/:cohortId/admin/applications/:applicationId/documents/:type/file` | ADMIN | 200 | Скачать generated document |
| GET | `/api/v1/cohorts/:cohortId/admin/applications/:applicationId/report/file` | ADMIN | 200 | Скачать report |
| GET | `/api/v1/cohorts/:cohortId/admin/documents` | ADMIN | 200 | Admin document list/read model |
| GET | `/api/v1/cohorts/:cohortId/admin/documents/:applicationId` | ADMIN | 200 | Admin document detail |
| GET | `/api/v1/cohorts/:cohortId/admin/overview` | ADMIN | 200 | Cohort aggregates |
| GET | `/api/v1/cohorts/:cohortId/applications` | ADMIN | 200 | Applications in cohort |
| GET | `/api/v1/cohorts/:cohortId/applications/:applicationId` | ADMIN | 200 | Application in cohort |
| PATCH | `/api/v1/cohorts/:cohortId/applications/:applicationId/report/status` | ADMIN | 200 | Review report |
| PATCH | `/api/v1/cohorts/:cohortId/applications/:applicationId/status` | ADMIN | 200 | Approve/reject application |
| GET | `/api/v1/cohorts/:cohortId/applications/:applicationId/test-task-submission` | ADMIN | 200 | Submission metadata |
| GET | `/api/v1/cohorts/:cohortId/progress` | ADMIN | 200 | Weekly cohort progress |
| GET | `/api/v1/cohorts/:cohortId/progress/missed` | ADMIN | 200 | Missed daily tasks |
| DELETE | `/api/v1/cohorts/:cohortId/tracks/:trackId/test-task` | ADMIN | 200 | Delete test task |
| GET | `/api/v1/cohorts/:cohortId/tracks/:trackId/test-task` | ADMIN | 200 | Admin test task metadata |
| PUT | `/api/v1/cohorts/:cohortId/tracks/:trackId/test-task` | ADMIN | 200 | Create/update test task |
| POST | `/api/v1/cohorts/:cohortId/tracks/:trackId/test-task/file` | ADMIN | 200 | Upload test task file |
| POST | `/api/v1/cohorts/:cohortId/tracks/:trackId/test-task/publish` | ADMIN | 200 | Publish test task |
| GET | `/api/v1/cohorts/public/current` | Public | 200 | Current accepting cohort |
| GET | `/api/v1/files/:category/:fileName` | STUDENT or ADMIN | 200 | Protected task/submission file |
| POST | `/api/v1/invitations` | ADMIN | 201 | Create/replace invitation |
| POST | `/api/v1/invitations/validate` | Public | 200 | Validate invitation |
| GET | `/api/v1/me/applications` | STUDENT | 200 | Own application archive |
| GET | `/api/v1/me/applications/:applicationId` | STUDENT | 200 | Own application detail |
| GET | `/api/v1/me/applications/:applicationId/documents` | STUDENT | 200 | Own document EAV data |
| PUT | `/api/v1/me/applications/:applicationId/documents/:type/fields/:fieldKey` | STUDENT | 200 | Autosave student-owned field |
| GET | `/api/v1/me/applications/:applicationId/documents/:type/file` | STUDENT | 200 | Download own generated document |
| GET | `/api/v1/me/applications/:applicationId/documents/:type/generate` | STUDENT | 200 | Generate DOCX |
| GET | `/api/v1/me/applications/:applicationId/documents/readiness` | STUDENT | 200 | Document readiness |
| GET | `/api/v1/me/applications/:applicationId/report` | STUDENT | 200 | Own report metadata |
| PUT | `/api/v1/me/applications/:applicationId/report` | STUDENT | 200 | Upload/replace report |
| GET | `/api/v1/me/applications/:applicationId/report/file` | STUDENT | 200 | Download own report |
| GET | `/api/v1/me/applications/:applicationId/tasks` | STUDENT | 200 | Own weekly progress |
| GET | `/api/v1/me/applications/:applicationId/test-task` | STUDENT | 200 | Published task state |
| GET | `/api/v1/me/applications/:applicationId/test-task-submission` | STUDENT | 200 | Own submission metadata |
| PUT | `/api/v1/me/applications/:applicationId/test-task-submission` | STUDENT | 200 | Upload/replace submission |
| PUT | `/api/v1/me/daily-tasks/:taskId` | STUDENT | 200 | Save daily task cell |
| POST | `/api/v1/public/invitations/:token/applications` | STUDENT | 201 | Submit application by invitation |
| GET | `/api/v1/public/invitations/:token/form` | Public | 200 | Public cohort/track/survey form |
| POST | `/api/v1/surveys` | ADMIN | 201 | Create survey |
| DELETE | `/api/v1/surveys/:surveyId` | ADMIN | 204 | Delete survey |
| GET | `/api/v1/surveys/:surveyId` | ADMIN | 200 | Survey with questions |
| PATCH | `/api/v1/surveys/:surveyId` | ADMIN | 200 | Rename survey |
| POST | `/api/v1/surveys/:surveyId/copy` | ADMIN | 201 | Copy survey to cohort |
| GET | `/api/v1/surveys/:surveyId/questions` | ADMIN | 200 | Ordered question list |
| POST | `/api/v1/surveys/:surveyId/questions` | ADMIN | 201 | Create question |
| DELETE | `/api/v1/surveys/:surveyId/questions/:questionId` | ADMIN | 204 | Delete question |
| GET | `/api/v1/surveys/:surveyId/questions/:questionId` | ADMIN | 200 | Question detail |
| PATCH | `/api/v1/surveys/:surveyId/questions/:questionId` | ADMIN | 200 | Update question |
| PATCH | `/api/v1/surveys/:surveyId/questions/reorder` | ADMIN | 200 | Replace question order |
| GET | `/api/v1/tracks` | Authenticated + `X-Cohort-Id` | 200 | Tracks in cohort context |
| POST | `/api/v1/tracks` | ADMIN | 201 | Create track |
<!-- ROUTE_INVENTORY_END -->

Operational endpoints:

| Method | Path | Access | Success |
|---|---|---|---:|
| GET | `/` | Public | 200 |
| GET | `/health` | Public | 200 |
| GET | `/ready` | Public | 200 или 503 |

## 3. Auth

### Register

```json
{
  "email": "student@example.com",
  "password": "student-password",
  "full_name": "Иван Иванов"
}
```

Response `201`:

```json
{
  "id": "user-id",
  "email": "student@example.com",
  "full_name": "Иван Иванов",
  "role": "STUDENT",
  "active_cohort_id": null,
  "created_at": "2026-07-14T08:00:00.000Z"
}
```

Пароль содержит минимум 6 символов; email нормализуется. Duplicate email возвращает `409`.

### Login и profile

Login body:

```json
{
  "email": "student@example.com",
  "password": "student-password"
}
```

Response `200`:

```json
{
  "token": "jwt-token"
}
```

`GET /api/v1/auth/me` возвращает те же публичные user fields без password hash.

## 4. Cohorts, tracks и invitations

Create cohort body:

```json
{
  "title": "Летняя практика",
  "status": "ACTIVE",
  "application_start": "2026-07-01T00:00:00.000Z",
  "application_end": "2026-07-10T00:00:00.000Z",
  "practice_start": "2026-07-13T00:00:00.000Z",
  "practice_end": "2026-08-07T00:00:00.000Z"
}
```

`DRAFT`, `ACTIVE`, `CLOSED` — допустимые statuses. Для `ACTIVE` обязательно application window; диапазоны дат не пересекаются в обратном порядке.

Create track body:

```json
{
  "cohort_id": "cohort-id",
  "title": "Backend"
}
```

Track title уникален внутри cohort. `GET /api/v1/tracks` требует `X-Cohort-Id: cohort-id`.

Create invitation body:

```json
{
  "cohort_id": "cohort-id",
  "expires_in_days": 7
}
```

Validate body и response:

```json
{
  "token": "invitation-token"
}
```

```json
{
  "valid": true,
  "cohort_id": "cohort-id",
  "cohort_title": "Летняя практика"
}
```

Ошибки: `COHORT_NOT_FOUND`, `TRACK_ALREADY_EXISTS`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `COHORT_CLOSED`, `APPLICATION_WINDOW_CLOSED`, `COHORT_CONTEXT_MISSING`, `COHORT_CONTEXT_MISMATCH`.

## 5. Survey и public form

Create survey:

```json
{
  "cohort_id": "cohort-id",
  "title": "Анкета кандидата"
}
```

Create/update question fields:

```json
{
  "label": "Выберите направление",
  "type": "SELECT",
  "required": true,
  "order_index": 0,
  "options": ["Backend", "Frontend"]
}
```

Question types: `TEXT`, `TEXTAREA`, `SELECT`, `RADIO`, `CHECKBOX`. Choice types требуют непустые уникальные `options`; text types не принимают options.

Reorder body:

```json
{
  "question_ids": ["question-2", "question-1"]
}
```

Copy body:

```json
{
  "target_cohort_id": "target-cohort-id",
  "title": "Копия анкеты"
}
```

Public form response:

```json
{
  "cohort": { "id": "cohort-id", "title": "Летняя практика" },
  "tracks": [{ "id": "track-id", "title": "Backend" }],
  "survey": {
    "id": "survey-id",
    "title": "Анкета кандидата",
    "questions": [{
      "id": "question-id",
      "label": "Почему вы хотите пройти практику?",
      "type": "TEXTAREA",
      "required": true,
      "order_index": 0,
      "options": null
    }]
  }
}
```

Ошибки: `SURVEY_NOT_FOUND`, `QUESTION_NOT_FOUND`, `SURVEY_ALREADY_EXISTS`, `INVALID_QUESTION_ORDER`, `SOURCE_SURVEY_NOT_FOUND`, `TARGET_COHORT_NOT_FOUND`, `TARGET_SURVEY_ALREADY_EXISTS`.

## 6. Applications

Submit body:

```json
{
  "track_id": "track-id",
  "answers": [
    { "question_id": "question-id", "answer_value": "Хочу получить опыт" }
  ]
}
```

Invitation определяет cohort. Сервер проверяет track/question ownership, required answers и уникальную пару user/track. Application response содержит Prisma application fields, `track.cohort` и ordered answers.

Status body:

```json
{
  "status": "REJECTED",
  "rejection_reason": "Не выполнено тестовое задание"
}
```

Допустимы `APPROVED` и `REJECTED`. Для rejection обязательна причина. Первый переход в `APPROVED` атомарно создаёт weekday calendar; повторный approval идемпотентен; `APPROVED -> REJECTED` запрещён.

Ошибки: `APPLICATION_ALREADY_EXISTS`, `APPLICATION_NOT_FOUND`, `TRACK_COHORT_MISMATCH`, `QUESTION_COHORT_MISMATCH`, `DUPLICATE_ANSWER`, `REQUIRED_ANSWER_MISSING`, `INVALID_STATUS_TRANSITION`.

## 7. Test tasks, submissions и task files

Create/update task body:

```json
{
  "title": "Тестовое задание",
  "description": "Реализовать API"
}
```

Task file upload: multipart field `file`; разрешены PDF, DOC, DOCX, ZIP. Publish выполняется один раз. Task response:

```json
{
  "id": "test-task-id",
  "track_id": "track-id",
  "title": "Тестовое задание",
  "description": "Реализовать API",
  "published_at": "2026-07-14T08:00:00.000Z",
  "available": true,
  "has_file": true,
  "download_path": "/files/test-tasks/file-id.pdf"
}
```

До публикации student response имеет `{ "available": false, "message": "..." }`. Submission upload использует multipart field `file` и те же extensions. Response не раскрывает storage key:

```json
{
  "id": "submission-id",
  "application_id": "application-id",
  "submitted_at": "2026-07-14T08:30:00.000Z",
  "has_file": true
}
```

Protected `/api/v1/files/:category/:fileName` проверяет actor/resource ownership и возвращает binary attachment с `Cache-Control: private, no-store`. JSON содержит только opaque `download_path`, но не отдельное raw storage field.

Ошибки: `TRACK_NOT_FOUND`, `TEST_TASK_NOT_FOUND`, `TEST_TASK_ALREADY_PUBLISHED`, `TEST_TASK_NOT_PUBLISHED`, `TEST_TASK_SUBMISSION_NOT_FOUND`, upload policy errors и protected `FILE_NOT_FOUND`.

## 8. Daily progress

Все weekly endpoints требуют query `weekStart=YYYY-MM-DD`, который нормализуется к понедельнику. Возвращаются только weekdays.

Daily task body:

```json
{
  "description": "Подготовил отчёт",
  "links": [
    { "url": "https://example.com/result" }
  ]
}
```

`description` может быть `null`; максимум 10 000 символов. `links` содержит до 50 уникальных URL и заменяется атомарно.

Student week response:

```json
{
  "applicationId": "application-id",
  "cohort": {
    "id": "cohort-id",
    "title": "Летняя практика",
    "practice_start": "2026-07-13T00:00:00.000Z",
    "practice_end": "2026-08-07T00:00:00.000Z"
  },
  "track": { "id": "track-id", "title": "Backend" },
  "weekStart": "2026-07-13",
  "weekEnd": "2026-07-19",
  "days": [{ "date": "2026-07-13", "task": null }]
}
```

Admin cohort response содержит `days` и `students[]` с application/student/track/tasks. Missed endpoint принимает optional `studentId`; пропуск — past-or-current UTC weekday task с `description = null` у approved application.

Ошибки: `INVALID_WEEK_START`, `DAILY_TASK_NOT_FOUND`, `DAILY_TASK_WEEKEND_EDIT_FORBIDDEN`, `APPLICATION_NOT_FOUND`, `COHORT_NOT_FOUND`.

## 9. Reports и documents

Document enum для EAV/read/download: `INDIVIDUAL_TASK`, `TITLE_PAGE`, `REVIEW`, `NOTICE`. Generate endpoint использует slug: `individual-task`, `title-page`, `review`, `notice`.

Autosave body:

```json
{
  "value": "Иван Иванов"
}
```

Student может менять только student-owned fields, ADMIN — только admin-owned review fields. Required fields:

| Document | Required fields | Дополнительное условие |
|---|---|---|
| `INDIVIDUAL_TASK` | `student_fio`, `group`, `direction_code`, `direction_name`, `program_name`, `practice_topic`, `main_stage_tasks` | — |
| `TITLE_PAGE` | `student_fio`, `group`, `specialty`, `practice_topic` | report `APPROVED` |
| `REVIEW` | `review_activities`, `review_characteristic`, `review_employed`, `review_next_practice`, `review_employment_offer`, `review_suggestions`, `review_grade` | ADMIN fields |
| `NOTICE` | `student_fio`, `group`, `practice_topic` | — |

Readiness response:

```json
{
  "applicationId": "application-id",
  "report": { "status": "APPROVED", "reviewedAt": "2026-07-14T09:00:00.000Z" },
  "documents": [{
    "type": "TITLE_PAGE",
    "ready": true,
    "missingFields": [],
    "generated": false,
    "generatedAt": null,
    "downloadPath": null
  }]
}
```

Report upload: multipart field `report`; PDF, DOC, DOCX. Замена сбрасывает status в `PENDING`. Review body:

```json
{
  "status": "APPROVED"
}
```

Report metadata:

```json
{
  "id": "report-id",
  "applicationId": "application-id",
  "status": "APPROVED",
  "uploadedAt": "2026-07-14T08:45:00.000Z",
  "reviewedAt": "2026-07-14T09:00:00.000Z",
  "hasFile": true,
  "downloadPath": "/me/applications/application-id/report/file"
}
```

Generate возвращает DOCX attachment и сохраняет metadata. Download endpoints возвращают binary attachment с `private, no-store`; несуществующий, чужой или cross-cohort file одинаково скрывается за `DOCUMENT_FILE_NOT_FOUND`.

Ошибки: `INVALID_DOCUMENT_TYPE`, `DOCUMENT_FIELD_NOT_FOUND`, `DOCUMENT_FIELD_FORBIDDEN`, `DOCUMENT_NOT_READY`, `REPORT_NOT_FOUND`, `DOCUMENT_FILE_NOT_FOUND` и upload policy errors.

## 10. Admin read models

Applications filters: `status=PENDING|APPROVED|REJECTED`, `trackId`, `search`. Response — array:

```json
[
  {
    "applicationId": "application-id",
    "status": "APPROVED",
    "submittedAt": "2026-07-14T08:00:00.000Z",
    "rejectionReason": null,
    "student": { "id": "student-id", "full_name": "Иван Иванов", "email": "student@example.com" },
    "track": { "id": "track-id", "title": "Backend" },
    "testTaskSubmission": null,
    "report": null,
    "missedDays": 1
  }
]
```

Application detail дополнительно содержит ordered `answers`, report metadata и readiness всех документов.

Document filters: `trackId`, `studentId`, `search`, `reportStatus=MISSING|PENDING|APPROVED|REJECTED`, `documentType=INDIVIDUAL_TASK|TITLE_PAGE|REVIEW|NOTICE`, `readiness=READY|INCOMPLETE`. В список входят только approved applications. Document detail дополнительно возвращает `fieldValues` как `{ type, values: [{ key, value, filledBy }] }`.

Overview response:

```json
{
  "cohortId": "cohort-id",
  "applications": {
    "total": 2,
    "statuses": { "PENDING": 0, "APPROVED": 1, "REJECTED": 1 }
  },
  "documents": {
    "approvedApplications": 1,
    "reports": { "MISSING": 0, "PENDING": 0, "APPROVED": 1, "REJECTED": 0 },
    "types": [{ "type": "NOTICE", "ready": 1, "generated": 1, "total": 1 }]
  },
  "progress": { "totalTasks": 20, "missedTasks": 1 }
}
```

## 11. HTTP и domain error reference

| HTTP | Типичные codes |
|---:|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, invalid date/window/order/type/upload errors |
| 401 | `AUTH_TOKEN_MISSING`, `AUTH_TOKEN_INVALID_FORMAT`, `AUTH_TOKEN_INVALID`, `INVALID_CREDENTIALS` |
| 403 | `INSUFFICIENT_PERMISSIONS`, resource/state forbidden errors |
| 404 | Cohort/application/track/survey/question/task/report/document/file not found; `ROUTE_NOT_FOUND` |
| 409 | Duplicate user/track/survey/application или repeated publication |
| 413 | `PAYLOAD_TOO_LARGE` |
| 429 | `RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED` |
| 500 | `INTERNAL_SERVER_ERROR` без внутренних деталей |

## 12. Compatibility boundary

- Старые unversioned business paths намеренно не обслуживаются.
- Operational endpoints остаются unversioned.
- Frontend не должен строить URL к upload directory или сохранять storage key.
- Новый business endpoint обязан одновременно обновить registry, этот route inventory и contract tests.
- Изменение существующего request/response требует явного contract review.
