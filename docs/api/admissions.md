# Локальный API Contract: Контур Admissions (Backend 1)

## 1. Аутентификация и контекст пользователя
Базовый путь: `/auth`

### POST /auth/register
* **Описание:** Регистрация нового пользователя в системе.
* **Тело запроса:**

```
json
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
* **Описание:** Получение профиля текущего пользователя на основе JWT. Возвращает системную роль (`admin` / `practicant`) и текущую активную когорту `active_cohort_id`.

## 2. Когорты и Треки
Базовые пути: `/cohorts`, `/tracks`, `/invitations`

### GET /cohorts/public/current
* **Описание:** Поиск активной когорты по текущему временному окну подачи заявок.

### POST /invitations/validate
* **Описание:** Проверка публичного токена приглашения для регистрации в когорте.

## 3. Заявки (Applications) и Анкеты
Базовый путь: `/applications`

### POST /applications
* **Описание:** Подача заявки на конкретный трек (`track_id`) с массивом ответов на вопросы анкеты (`questions`).
* **Бизнес-правило:** Один пользователь может подать только одну заявку на конкретный трек внутри когорты.

### PATCH /applications/:id/status
* **Описание:** Изменение статуса заявки (только для ADMIN).
* **Тело запроса при отказе:**

```
json
{
"status": "rejected",
"rejection_reason": "Недостаточный уровень владения базовым стеком"
}
```
## Cohort, Track and Invitation rules

### Cohort API

`GET /cohorts/public/current` is public and returns only an `ACTIVE` cohort whose current time is inside `application_start .. application_end`.

`POST /cohorts` requires `ADMIN`. The server validates `title`, `practice_start`, `practice_end` and the optional application window. Date ranges must not be reversed, and `created_by` is taken from the authenticated user.

Cohort statuses are `DRAFT`, `ACTIVE`, and `CLOSED`. Closed cohorts do not accept new invitations or applications.

### Track API

`POST /tracks` requires `ADMIN`, validates the cohort, and accepts `cohort_id` and `title`. Track titles are unique inside one cohort.

`GET /tracks` requires authentication and an explicitly verified cohort context. It returns tracks from that cohort only; cross-cohort resources must not be exposed or accepted.

### Invitation API

`POST /invitations` requires `ADMIN`, validates a positive `expires_in_days`, and generates the token server-side using a cryptographically secure random generator. A new invitation replaces the previous invitation for the same cohort.

`POST /invitations/validate` is public. The server checks token existence, expiration, linked cohort status, and the application window. The response exposes only public cohort data required for registration.

### Authorization, context and errors

- Private endpoints require a valid JWT; missing or invalid tokens return `401`.
- Role checks are performed server-side; insufficient permissions return `403`.
- Cohort context comes from an explicit route parameter or approved request header and is verified server-side. `active_cohort_id` is a UI preference, not an authorization source.
- Validation errors return `400`; invalid or expired invitations use stable error codes.
- Errors follow the common envelope: `code`, `message`, `details`, `requestId`.
