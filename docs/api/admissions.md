# Admissions API fragment

Центральный frozen contract находится в `docs/api-contract.md`. Этот файл сохраняет расширенный доменный контекст admissions-модулей.

Все production endpoints в этом документе доступны с общим префиксом
`/api/v1`. Например, локальный путь `/auth/login` вызывается как
`POST /api/v1/auth/login`.

## 1. Аутентификация и контекст пользователя
Базовый путь внутри API: `/auth`

### POST /auth/register
* **Описание:** Регистрация нового пользователя в системе.
* **Тело запроса:**

```json
{
"email": "student@test.com",
"password": "secure_password",
"full_name": "Иванов Иван Иванович"
}
```

* **Ответ (201 Created):** Идентификатор созданного пользователя и базовые поля (без хэша пароля).

### POST /auth/login
* **Описание:** Авторизация, выдача JWT-токена.
* **Ответ (200 OK):** `{ "token": "ey..." }`

### GET /auth/me
* **Описание:** Получение профиля текущего пользователя на основе JWT. Возвращает системную роль (`ADMIN` / `STUDENT`) и UI preference `active_cohort_id`.

## 2. Когорты и Треки
Базовые пути: `/cohorts`, `/tracks`, `/invitations`

### GET /cohorts/public/current
* **Описание:** Поиск активной когорты по текущему временному окну подачи заявок.

### POST /invitations/validate
* **Описание:** Проверка публичного токена приглашения для регистрации в когорте.

## 3. Applications lifecycle

### POST /public/invitations/:token/applications

Requires an authenticated `STUDENT`. The invitation token determines the cohort; the request may submit only a track and questions belonging to that cohort's survey.

```json
{
  "track_id": "track-id",
  "answers": [
    { "question_id": "question-id", "answer_value": "Answer" }
  ]
}
```

The server validates the invitation window, track/question isolation, required questions and the unique `(user_id, track_id)` constraint. `Application` and `ApplicationAnswer` are created in one transaction with status `PENDING`.

### GET /me/applications and GET /me/applications/:applicationId

Requires `STUDENT`. Returns only the current user's applications, including track, cohort and answers.

### GET /cohorts/:cohortId/applications

Requires `ADMIN`. Returns applications whose `track.cohort_id` equals the route cohort.

### GET /cohorts/:cohortId/applications/:applicationId

Requires `ADMIN` and returns an application only when it belongs to the route cohort.

### PATCH /cohorts/:cohortId/applications/:applicationId/status

Requires `ADMIN`. Accepts `APPROVED` or `REJECTED`; `REJECTED` requires `rejection_reason`. On the transition to `APPROVED`, the application service invokes Backend B's public `DailyTaskCalendarService` inside the same Prisma transaction. Repeated approval is idempotent.
## Cohort, Track and Invitation rules

### Cohort API

`GET /cohorts/public/current` is public and returns only an `ACTIVE` cohort whose current time is inside `application_start .. application_end`.

`POST /cohorts` requires `ADMIN`. The server validates `title`, `practice_start`, `practice_end` and the optional application window. Date ranges must not be reversed, and `created_by` is taken from the authenticated user.

Administrative management is available through `GET /cohorts`, `GET /cohorts/:cohortId`, and `PATCH /cohorts/:cohortId`. Status transitions use `PATCH /cohorts/:cohortId/activate` and `PATCH /cohorts/:cohortId/close`; only `DRAFT -> ACTIVE -> CLOSED` is accepted, and only one cohort may be active at a time.

Cohort statuses are `DRAFT`, `ACTIVE`, and `CLOSED`. Closed cohorts do not accept new invitations or applications.

### Track API

`POST /tracks` requires `ADMIN`, validates the cohort, and accepts `cohort_id` and `title`. Track titles are unique inside one cohort.

`GET /tracks` requires authentication and an explicitly verified cohort context. It returns tracks from that cohort only; cross-cohort resources must not be exposed or accepted.

The admin workspace may use the explicit equivalents `GET/POST /cohorts/:cohortId/tracks`, `PATCH /cohorts/:cohortId/tracks/:trackId`, and `DELETE /cohorts/:cohortId/tracks/:trackId`. Track deletion is rejected when applications already exist for the track.

### Invitation API

`POST /invitations` requires `ADMIN`, validates a positive `expires_in_days`, and generates the token server-side using a cryptographically secure random generator. A new invitation replaces the previous invitation for the same cohort.

`POST /invitations/validate` is public. The server checks token existence, expiration, linked cohort status, and the application window. The response exposes only public cohort data required for registration.

The admin workspace may use `POST /cohorts/:cohortId/invitation` and `POST /cohorts/:cohortId/invitation/regenerate`; both generate a server-side token and replace the previous invitation for that cohort.
`DELETE /cohorts/:cohortId/invitation` removes the current invitation when the admin explicitly removes the application link.

For survey editing, the explicit cohort routes are `GET/POST /cohorts/:cohortId/survey` and `POST/PATCH/DELETE /cohorts/:cohortId/survey/questions/...`. They resolve the survey through the cohort and enforce question ownership.

### Authorization, context and errors

- Private endpoints require a valid JWT; missing or invalid tokens return `401`.
- Role checks are performed server-side; insufficient permissions return `403`.
- Cohort context comes from an explicit route parameter or approved request header and is verified server-side. `active_cohort_id` is a UI preference, not an authorization source.
- Validation errors return `400`; invalid or expired invitations use stable error codes.
- Domain errors follow the common envelope: `code`, `message`, `details`, `requestId`. Auth register/login validation сохраняет фактический отдельный `{ message, errors }` shape, зафиксированный в центральном контракте.

## Test tasks and submissions

`TestTask` belongs to a `Track`; one track can have at most one task. All
administrative routes verify that the track belongs to the selected cohort.

### GET /cohorts/:cohortId/tracks/:trackId/test-task

Requires `ADMIN`. Returns task metadata, publication state and `has_file`.
Physical filesystem paths are never returned.

### PUT /cohorts/:cohortId/tracks/:trackId/test-task

Requires `ADMIN`. Creates or updates the task. The body contains `title` and
optional `description`; publication is controlled separately.

### POST /cohorts/:cohortId/tracks/:trackId/test-task/file

Requires `ADMIN`. Accepts one multipart file under `file`. The B-01 policy
allows PDF, DOC, DOCX and ZIP files in the `test-tasks` category. Replacing a
file updates the storage key and cleans up the previous file after the database
update.

### POST /cohorts/:cohortId/tracks/:trackId/test-task/publish

Requires `ADMIN`. Publishes once by setting `published_at`. Notifications are
sent only to users with applications for this track. A failed email does not
roll back publication or prevent other recipients from being attempted.

### GET /me/applications/:applicationId/test-task

Requires `STUDENT` and returns a task only for the application owner. Before
publication it returns `available: false` and a waiting message. A published
task returns its metadata and file presence.

### PUT /me/applications/:applicationId/test-task-submission

Requires `STUDENT` and accepts one multipart `file`. The task must be published
and the application must belong to the current user. The single submission is
upserted; replacement updates `submitted_at` and removes the previous file.

### GET /me/applications/:applicationId/test-task-submission

Requires `STUDENT` and returns only the current student's submission metadata.
Physical access uses the shared protected download handler and a domain policy;
public `/uploads/*` URLs are not used.

### GET /cohorts/:cohortId/applications/:applicationId/test-task-submission

Requires `ADMIN` and returns a submission only when the application belongs to
the selected cohort. The response contains a protected `download_path`, never
an absolute filesystem path.

### GET /files/:category/:fileName

Protected download route. A student can open only their own submission or a
published task, while an admin can open task/submission files after domain
ownership checks.

### DELETE /cohorts/:cohortId/tracks/:trackId/test-task

Requires `ADMIN`. Deletes the task and cleans up its stored file, if present.

## Candidate E2E checklist

The local admissions flow is verified in this order:

1. Validate an invitation without authentication.
2. Read the public invitation form without authentication.
3. Register and login as a `STUDENT`.
4. Read `/auth/me` and use the returned JWT on private requests.
5. Submit one application for a track and answer every required question.
6. Read the student's application archive and application detail.
7. Read the published test task and upload its submission.
8. Login as `ADMIN`, read the selected cohort applications and submission.
9. Approve the application and verify the student's `APPROVED` status.

The integration flow is executed against an isolated PostgreSQL database only
when `RUN_DB_INTEGRATION=true` is set. The ordinary unit suite skips this flow.

## Authentication and error contract

Private endpoints require:

```text
Authorization: Bearer <jwt>
```

The production router exposes every path below `/api/v1`. A request without a token or
with an invalid token receives `401`. A valid token with an insufficient role
receives `403`.

Validation and domain errors use the common response shape:

```json
{
  "code": "ERROR_CODE",
  "message": "Readable message",
  "details": null,
  "requestId": "request-id"
}
```

Resource ownership is always checked from server-side relations. A student's
application is scoped by `Application.user_id`; an administrative application,
track, task or submission is scoped through `Application.track.cohort_id` or
`Track.cohort_id`. `active_cohort_id` is only a UI preference and is not an
authorization source.

## Integration ownership

The A-07 test harness remains an isolated module test. B-06 additionally runs
the candidate and practice scenario through production `createApp()` and the
real `/api/v1` registry. Central `docs/api-contract.md` consolidation remains
the B-07 scope.
