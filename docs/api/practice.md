# Practice Progress and Admin Read API

Контракт B-03/B-05 для ежедневного прогресса и административных read models.

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

B-05 официально переиспользует этот B-03 read model как недельную таблицу административной вкладки прогресса. Отдельная копия progress service в `modules/admin` не создаётся.

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

## 7. Административные заявки B-05

```http
GET /cohorts/:cohortId/admin/applications?status=&trackId=&search=
GET /cohorts/:cohortId/admin/applications/:applicationId
```

Доступ: только `ADMIN`. Список поддерживает фильтры по статусу заявки, треку и регистронезависимый поиск по ФИО или email. Ответ строится через `Application -> Track -> Cohort` и содержит студента, трек, metadata решения тестового задания, статус отчёта и число пропущенных дней.

Detail дополнительно возвращает ответы анкеты в порядке вопросов и вычисляемую готовность документов. Физические storage keys отчёта и решения в read model не раскрываются; скачивание выполняется только через защищённые endpoints соответствующих доменных модулей.

`applicationId` является идентификатором административной карточки. `userId` не используется, поскольку студент может иметь несколько заявок в одной когорте на разные треки.

## 8. Административные документы B-05

```http
GET /cohorts/:cohortId/admin/documents?trackId=&studentId=&search=&reportStatus=&documentType=&readiness=
GET /cohorts/:cohortId/admin/documents/:applicationId
```

Доступ: только `ADMIN`. В выборку входят только заявки со статусом `APPROVED` из указанной когорты.

Допустимые фильтры:

- `reportStatus`: `MISSING`, `PENDING`, `APPROVED`, `REJECTED`;
- `documentType`: `INDIVIDUAL_TASK`, `TITLE_PAGE`, `REVIEW`, `NOTICE`;
- `readiness`: `READY` или `INCOMPLETE`;
- `trackId`, `studentId`, `search`.

Каждая заявка содержит четыре вычисляемых состояния документов:

```json
{
  "type": "TITLE_PAGE",
  "ready": false,
  "missingFields": ["report.status:APPROVED"],
  "generated": false,
  "generatedAt": null
}
```

Правила readiness общие со student API B-04 и читаются из `DOCUMENT_CONFIG`; они не дублируются в admin-модуле и не сохраняются в БД. Detail также возвращает EAV-значения как `{ key, value, filledBy }`.

Для существующего файла read model возвращает resource-based `downloadPath`, но никогда не возвращает `file_url` или `generated_file_url`.

## 9. Защищённое скачивание отчётов и документов

```http
GET /me/applications/:applicationId/report/file
GET /me/applications/:applicationId/documents/:type/file
GET /cohorts/:cohortId/admin/applications/:applicationId/report/file
GET /cohorts/:cohortId/admin/applications/:applicationId/documents/:type/file
```

Student endpoints проверяют владельца одобренной заявки. Admin endpoints требуют роль `ADMIN` и проверяют принадлежность заявки выбранной когорте через `Application.track.cohort_id`.

Файл открывается через B-01 `StorageService` только после доменной проверки. Отсутствующий файл, чужая заявка и заявка другой когорты возвращают одинаковый `404 DOCUMENT_FILE_NOT_FOUND`. Ответ содержит `Cache-Control: private, no-store` и `X-Content-Type-Options: nosniff`.

Сгенерированный DOCX сохраняется в категории `generated-documents`; после успешной генерации обновляются `Document.generated_file_url` и `Document.generated_at`. Повторная генерация заменяет предыдущий файл через storage abstraction.

## 10. Административная сводка B-05

```http
GET /cohorts/:cohortId/admin/overview
```

Ответ содержит:

- количество заявок по `ApplicationStatus`;
- количество отсутствующих и загруженных отчётов по `ReportStatus`;
- ready/generated/total для каждого `DocumentType`;
- общее число DailyTask и число пропусков до текущей UTC-даты.

Все агрегаты ограничены `cohortId` через связь `Application.track.cohort_id`.

## 11. Ошибки и изоляция B-05

| Code | HTTP | Значение |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | JWT отсутствует или не прошёл проверку |
| `INSUFFICIENT_PERMISSIONS` | 403 | Endpoint вызван не администратором |
| `VALIDATION_ERROR` | 400 | Некорректный route/query параметр |
| `COHORT_NOT_FOUND` | 404 | Когорта не существует |
| `APPLICATION_NOT_FOUND` | 404 | Заявка отсутствует, не одобрена для document detail или относится к другой когорте |
| `DOCUMENT_FILE_NOT_FOUND` | 404 | Файл отсутствует или недоступен в выбранном application/cohort context |

`active_cohort_id` не используется как источник авторизации. Каждый detail/list query содержит явное ограничение выбранной когорты. Admin read endpoints не изменяют Application, Report, Document или DailyTask.

Admin router смонтирован без дополнительного `/admin` prefix, поэтому текущий относительный путь совпадает с документированным `/cohorts/:cohortId/admin/...`. Добавление общего `/api/v1` prefix для всех модулей остаётся финальным шагом B-06.
