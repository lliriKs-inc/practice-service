# Practice Progress API

Контракт B-03 для ежедневного прогресса на моделях `DailyTask` и `DailyTaskLink`.

Все защищённые endpoints требуют JWT в заголовке:

```http
Authorization: Bearer <token>
```

Ошибки возвращаются через общий envelope:

```json
{
  "code": "DAILY_TASK_NOT_FOUND",
  "message": "Daily task not found",
  "details": null,
  "requestId": "request-id"
}
```

## 1. Редактирование ежедневной ячейки

```http
PUT /me/daily-tasks/:taskId
```

Доступ: студент. Изменять можно только DailyTask собственной одобренной заявки. Выходные и чужие задачи редактировать нельзя.

### Request

```json
{
  "description": "Подготовил отчёт и отправил руководителю",
  "links": [
    { "url": "https://github.com/example/project" },
    { "url": "https://example.com/report" }
  ]
}
```

`description` может быть `null`. Список `links` заменяется полностью. Дубли ссылок запрещены. При каждом успешном сохранении обновляется `saved_at`.

Для очистки ячейки:

```json
{
  "description": null,
  "links": []
}
```

### Response `200`

```json
{
  "id": "daily-task-id",
  "application_id": "application-id",
  "task_date": "2026-07-13T00:00:00.000Z",
  "description": "Подготовил отчёт и отправил руководителю",
  "saved_at": "2026-07-13T18:30:00.000Z",
  "links": [
    {
      "id": "link-id",
      "daily_task_id": "daily-task-id",
      "url": "https://github.com/example/project"
    }
  ]
}
```

## 2. Личный прогресс студента

```http
GET /me/applications/:applicationId/tasks?weekStart=2026-07-13
```

Доступ: студент. Возвращаются только задачи указанной заявки пользователя. Заявка должна иметь статус `APPROVED`.

`weekStart` — дата в формате `YYYY-MM-DD`. Она нормализуется к понедельнику соответствующей недели. В ответе присутствуют только понедельник–пятница.

### Response `200`

```json
{
  "applicationId": "application-id",
  "cohort": {
    "id": "cohort-id",
    "title": "Летняя практика",
    "practice_start": "2026-07-01T00:00:00.000Z",
    "practice_end": "2026-07-31T00:00:00.000Z"
  },
  "track": {
    "id": "track-id",
    "title": "Backend"
  },
  "weekStart": "2026-07-13",
  "weekEnd": "2026-07-19",
  "days": [
    {
      "date": "2026-07-13",
      "task": {
        "id": "daily-task-id",
        "task_date": "2026-07-13T00:00:00.000Z",
        "description": null,
        "saved_at": null,
        "links": []
      }
    }
  ]
}
```

Для рабочего дня без записи `task` равен `null`. Выходные не возвращаются.

## 3. Общий прогресс когорты

```http
GET /cohorts/:cohortId/progress?weekStart=2026-07-13
```

Доступ: администратор. Возвращаются только одобренные заявки выбранной когорты. Данные других когорт не выдаются.

### Response `200`

```json
{
  "cohort": {
    "id": "cohort-id",
    "title": "Летняя практика",
    "practiceStart": "2026-07-01T00:00:00.000Z",
    "practiceEnd": "2026-07-31T00:00:00.000Z"
  },
  "weekStart": "2026-07-13",
  "weekEnd": "2026-07-19",
  "days": [
    "2026-07-13",
    "2026-07-14",
    "2026-07-15",
    "2026-07-16",
    "2026-07-17"
  ],
  "students": [
    {
      "applicationId": "application-id",
      "student": {
        "id": "student-id",
        "full_name": "Иван Иванов",
        "email": "student@example.com"
      },
      "track": {
        "id": "track-id",
        "title": "Backend"
      },
      "tasks": [
        {
          "date": "2026-07-13",
          "task": null
        }
      ]
    }
  ]
}
```

## 4. Пропущенные дни

```http
GET /cohorts/:cohortId/progress/missed?weekStart=2026-07-13
```

Опционально можно отфильтровать одного студента:

```http
GET /cohorts/:cohortId/progress/missed?weekStart=2026-07-13&studentId=student-id
```

Доступ: администратор.

В список попадают только задачи, для которых:

- заявка имеет статус `APPROVED`;
- задача относится к выбранной когорте;
- `task_date` находится в указанной неделе;
- `task_date` не позднее текущей UTC-даты;
- `description IS NULL`.

Будущие даты и выходные не считаются пропущенными.

### Response `200`

```json
{
  "cohortId": "cohort-id",
  "weekStart": "2026-07-13",
  "weekEnd": "2026-07-19",
  "missed": [
    {
      "applicationId": "application-id",
      "taskId": "daily-task-id",
      "taskDate": "2026-07-13",
      "student": {
        "id": "student-id",
        "full_name": "Иван Иванов",
        "email": "student@example.com"
      },
      "track": {
        "id": "track-id",
        "title": "Backend"
      },
      "links": []
    }
  ]
}
```

## 5. Коды ошибок B-03

| Code | HTTP | Значение |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | Пользователь не авторизован |
| `APPLICATION_ID_REQUIRED` | 400 | Не передан application id |
| `COHORT_ID_REQUIRED` | 400 | Не передан cohort id |
| `INVALID_WEEK_START` | 400 | Некорректная дата недели |
| `APPLICATION_NOT_FOUND` | 404 | Заявка не найдена или недоступна пользователю |
| `COHORT_NOT_FOUND` | 404 | Когорта не найдена |
| `DAILY_TASK_NOT_FOUND` | 404 | Задача не найдена или принадлежит другому пользователю |
| `DAILY_TASK_WEEKEND_EDIT_FORBIDDEN` | 400 | Нельзя редактировать выходной день |
| `VALIDATION_ERROR` | 400 | Некорректное тело или query-параметры |

## 6. Источник данных и ограничения

- Календарь DailyTask создаётся B-02 внутри approval-транзакции A-05.
- B-03 не создаёт календарные строки вручную.
- Legacy `TaskCard` API не используется.
- Ссылки принадлежат конкретному DailyTask и заменяются атомарно вместе с описанием.
- `saved_at` обновляется при каждом успешном сохранении ячейки.
- Все даты календаря обрабатываются как UTC date-only.
