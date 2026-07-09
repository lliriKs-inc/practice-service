# **API Contract — Сервис «Практика»**

_Единый источник правды по всем backend-эндпоинтам._

**Правила редактирования:**

- Backend Developer №1 редактирует разделы: **Auth, Cohorts, CohortRole, Survey, Application, TestTask**
- Backend Developer №2 редактирует разделы: **Documents, Tasks, Admin**
- Frontend **не редактирует** этот файл, только читает
- Каждый новый/изменённый эндпоинт добавляется в контракт **в том же PR**, где он реализован
- Формат описания эндпоинта — см. шаблон в конце файла

**Base URL:** http://localhost:\<PORT\> (см. .env.example)

**Авторизация:** большинство эндпоинтов требуют заголовок Authorization: Bearer \<JWT\>. Публичные исключения помечены явно.

**Общий формат ошибки:**

{  
 "message": "Текст ошибки"  
}

## **Auth**

---

_Владелец: Backend Developer №1_

### **POST /auth/register**

Регистрация нового пользователя.

- **Авторизация:** не требуется
- **Body:**
  {
  "email": "user@example.com",
  "password": "strongpassword123"
  }
- **Response (201 Created):**
  {
  "id": "uuid-строка",
  "email": "user@example.com",
  "role": "STUDENT",
  "created_at": "2026-07-06T00:00:00.000Z"
  }
- **Ошибки:**
  - 400 Bad Request — { "message": "Validation failed", "errors": [...] } (если не прошла zod-валидация registerSchema)
  - 409 Conflict — { "message": "User already exists" }

### **POST /auth/login**

Получить JWT.

- **Авторизация:** не требуется
- **Body:**
  {
  "email": "admin@test.com",
  "password": "123456"
  }
- **Response (200 OK):**
  {
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
- **Ошибки:**
  - 400 Bad Request — { "message": "Validation failed", "errors": [...] } (если не прошла zod-валидация loginSchema)
  - 401 Unauthorized — { "message": "Invalid credentials" }

### **GET /auth/me**

Получить текущего пользователя по токену.

- **Авторизация:** требуется
- **Response (200 OK):**
  {
  "id": "uuid-строка",
  "email": "user@test.com",
  "role": "STUDENT",
  "created_at": "2026-07-06T00:00:00.000Z"
  }
- **Ошибки:**
  - 401 Unauthorized — токен отсутствует/невалиден (перехватывается authMiddleware до контроллера)
  - 400 Bad Request — { "message": "User not found" } (если пользователь удалён из базы, но токен ещё валиден — контроллер сейчас не различает типы ошибок и отдаёт 400 на любое исключение из getMe)

## **Cohorts**

---

_Владелец: Backend Developer №1_

Все /cohorts... эндпоинты требуют авторизацию. Создание/редактирование/активация — только ADMIN.

### **POST /cohorts**

Создать когорту.

- **Роль:** ADMIN
- **Body:**  
  {  
   "name": "2026-test",  
   "application_start": "2026-07-01T00:00:00.000Z",  
   "application_end": "2026-07-15T00:00:00.000Z",  
   "practice_start": "2026-08-01T00:00:00.000Z",  
   "practice_end": "2026-08-31T00:00:00.000Z"  
  }
- **Response (210 Created):**  
  {  
   "id": "uuid-строка",  
   "name": "2026-test",  
   "application_start": "2026-07-01T00:00:00.000Z",  
   "application_end": "2026-07-15T00:00:00.000Z",  
   "practice_start": "2026-08-01T00:00:00.000Z",  
   "practice_end": "2026-08-31T00:00:00.000Z"  
  }

### **GET /cohorts**

Список всех когорт.

- **Response (200 OK):**  
  \[  
   {  
   "id": "uuid-1",  
   "name": "2026-test",  
   "application_start": "2026-07-01T00:00:00.000Z",  
   "application_end": "2026-07-15T00:00:00.000Z",  
   "practice_start": "2026-08-01T00:00:00.000Z",  
   "practice_end": "2026-08-31T00:00:00.000Z"  
   }  
  \]

### **GET /cohorts/:id**

Получить одну когорту по id.

- **Response (200 OK):**  
  {  
   "id": "uuid-строка",  
   "name": "2026-test",  
   "application_start": "2026-07-01T00:00:00.000Z",  
   "application_end": "2026-07-15T00:00:00.000Z",  
   "practice_start": "2026-08-01T00:00:00.000Z",  
   "practice_end": "2026-08-31T00:00:00.000Z"  
  }
- **Ошибки:**
  - 404 Not Found — { "message": "Когорта не найдена" }

### **PATCH /cohorts/:id**

Частично обновить когорту.

- **Роль:** ADMIN
- **Body (пример подмножества полей):**  
  {  
   "name": "2026-updated",  
   "practice_end": "2026-09-05T00:00:00.000Z"  
  }
- **Response (200 OK):**  
  {  
   "id": "uuid-строка",  
   "name": "2026-updated",  
   "application_start": "2026-07-01T00:00:00.000Z",  
   "application_end": "2026-07-15T00:00:00.000Z",  
   "practice_start": "2026-08-01T00:00:00.000Z",  
   "practice_end": "2026-09-05T00:00:00.000Z"  
  }

### **POST /cohorts/:id/activate**

Выбрать активную когорту для текущего админа (записывается в User.active_cohort_id).

- **Роль:** ADMIN
- **Response (200 OK):**  
  {  
   "message": "Когорта успешно активирована",  
   "active_cohort_id": "uuid-активированной-когорты"  
  }
- **Ошибки:**
  - 404 Not Found — { "message": "Когорта не найдена" }

### **GET /cohorts/active/me**

Получить активную когорту текущего пользователя.

- **Response (200 OK):**  
  {  
   "active_cohort_id": "uuid-строка-или-null"  
  }

**Важно (для всех будущих модулей):** после authMiddleware работает cohortContextMiddleware, который кладёт req.cohortId на основе User.active_cohort_id. Все операции с сущностями, привязанными к когорте, должны использовать req.cohortId, а не cohort_id из body/query.

## **CohortRole**

---

_Владелец: Backend Developer №1_

Роуты подключены **раньше** /cohorts/:id, чтобы /cohorts/roles не перехватывался как параметр :id.

### **POST /cohorts/roles**

Создать роль/трек в активной когорте.

- **Роль:** ADMIN
- **Предусловие:** активная когорта выбрана (POST /cohorts/:id/activate)
- **Body:**  
  {  
   "name": "Backend"  
  }
- **Response (210 Created):**  
  {  
   "id": "uuid-роли",  
   "name": "Backend",  
   "cohort_id": "uuid-активной-когорты"  
  }
- **Ошибки:**
  - 400 Bad Request — { "message": "No active cohort selected" }

### **GET /cohorts/roles**

Получить роли только активной когорты.

- **Response (200 OK):**  
  \[  
   {  
   "id": "uuid-1",  
   "name": "Backend",  
   "cohort_id": "uuid-активной-когорты"  
   },  
   {  
   "id": "uuid-2",  
   "name": "Frontend",  
   "cohort_id": "uuid-активной-когорты"  
   }  
  \]
- **Ошибки:**
  - 400 Bad Request — { "message": "No active cohort selected" }

## **Survey**

---

_Владелец: Backend Developer №1_

_Статус: не реализовано (Этап 5, 0%)_

Планируемые эндпоинты:

- POST /survey-fields — создать поле анкеты
- GET /survey-fields — список полей активной когорты (сортировка по order)
- GET /survey-fields/:id — одно поле
- PATCH /survey-fields/:id — редактирование
- DELETE /survey-fields/:id — удаление

## **Application**

---

_Владелец: Backend Developer №1_

_Статус: не реализовано (Этап 5–6, 0%)_

Планируемые эндпоинты:

- POST /applications — подать заявку
- GET /applications/my — заявка текущего пользователя в активной когорте
- GET /applications/:id — просмотр заявки
- GET /applications — список всех заявок активной когорты (ADMIN)
- PATCH /applications/:id/approve — одобрить \+ назначить роль
- PATCH /applications/:id/reject — отклонить
- PATCH /applications/:id — комментарий администратора

**Важно для Dev №2 / Frontend:** доступ к Documents и Tasks проверяется через наличие записи со статусом APPROVED в этой когорте.

## **TestTask**

---

_Владелец: Backend Developer №1_

_Статус: не реализовано (Этап 5, 0%)_

- POST /test-task — создать тестовое задание
- GET /test-task — список заданий активной когорты
- PATCH /test-task/:id — редактирование
- DELETE /test-task/:id — удаление

## **Documents**

---

_Владелец: Backend Developer №2_

_Статус: реализовано (Этап 8\)_

### **GET /documents**

Данные документов текущего пользователя в активной когорте.

- **Response (200 OK):**
  {
  "id": "string",
  "user_id": "string",
  "cohort_id": "string",
  "student_fio": "string | null",
  "group": "string | null",
  "direction_code": "string | null",
  "direction_name": "string | null",
  "program_name": "string | null",
  "specialty": "string | null",
  "practice_topic": "string | null",
  "main_stage_tasks": "string | null",
  "review_activities": "string | null",
  "review_characteristic": "string | null",
  "review_employed": "string | null",
  "review_next_practice": "string | null",
  "review_employment_offer": "string | null",
  "review_suggestions": "string | null",
  "review_grade": "string | null",
  "report_file_url": "string | null",
  "report_admin_approved": false
  }
- **Ошибки:**  
  { "message": "Unauthorized" }  
  { "message": "No active cohort selected" }  
  { "message": "Application not approved" }

### **POST /documents**

Создаёт/инициализирует запись StudentDocumentData (upsert по user_id \+ cohort_id).

### **PATCH /documents**

Обновляет поля, заполняемые студентом.

- **Body (любое подмножество):**  
  {  
   "student_fio": "string",  
   "group": "string",  
   "direction_code": "string",  
   "direction_name": "string",  
   "program_name": "string",  
   "specialty": "string",  
   "practice_topic": "string",  
   "main_stage_tasks": "string"  
  }

### **POST /documents/report**

Загрузка файла отчёта.

- **Content-Type:** multipart/form-data
- **Поле формы:** report (допустимые форматы: pdf, doc, docx, макс 10 MB)
- **Результат:** report_file_url \= /uploads/\<filename\>

### **PATCH /documents/review**

Заполнение полей отзыва администратором.

- **Роль:** ADMIN
- **Body:**  
  {  
   "userId": "string",  
   "review_activities": "string",  
   "review_characteristic": "string",  
   "review_employed": "string",  
   "review_next_practice": "string",  
   "review_employment_offer": "string",  
   "review_suggestions": "string",  
   "review_grade": "string"  
  }

### **PATCH /documents/approve**

Подтверждение отчёта администратором.

- **Роль:** ADMIN
- **Body:**
  {
  "userId": "string"
  }
- **Response (200 OK):**
  {
  "message": "Report approved"
  }

### **GET /documents/readiness**

Готовность трёх документов к формированию.

- **Response (200 OK):**  
  {  
   "individual_task": {  
   "ready": false,  
   "missingFields": \["student_fio", "group"\]  
   },  
   "review": {  
   "ready": false,  
   "missingFields": \["review_activities"\]  
   },  
   "title_page": {  
   "ready": false,  
   "missingFields": \["report_admin_approved"\]  
   }  
  }

### **GET /documents/generate/:type**

Генерация и скачивание DOCX (individual-task, review, title-page).

- **Params:**
  - `type`: `individual-task` | `review` | `title-page`

## **Tasks**

---

_Владелец: Backend Developer №2_

_Статус: реализовано (Этап 9)_

Все endpoint'ы требуют `Authorization: Bearer <JWT>` и активную когорту (`req.cohortId`).

Студенческие endpoint'ы требуют наличие заявки со статусом `APPROVED` в активной когорте.

### **POST /tasks**

Создать карточку задачи текущего пользователя.

- **Body:**
  {
  "date": "2026-08-03T00:00:00.000Z",
  "title": "Разработка модуля",
  "description": "Описание выполненной работы",
  "artifact_link": "https://github.com/example/pr"
  }

- **Response (201 Created):**
  {
  "id": "uuid",
  "user_id": "uuid",
  "cohort_id": "uuid",
  "date": "2026-08-03T00:00:00.000Z",
  "title": "Разработка модуля",
  "description": "Описание выполненной работы",
  "artifact_link": "https://github.com/example/pr",
  "updated_at": "2026-08-03T12:00:00.000Z"
  }

- **Ошибки:**
  - 400 Bad Request — { "message": "No active cohort selected" }
  - 400 Bad Request — { "message": "Invalid task date" }
  - 400 Bad Request — { "message": "Task date is outside practice period" }
  - 403 Forbidden — { "message": "Application not approved" }

### **GET /tasks**

Получить задачи текущего пользователя в активной когорте.

- **Response (200 OK):**
  [
  {
  "id": "uuid",
  "user_id": "uuid",
  "cohort_id": "uuid",
  "date": "2026-08-03T00:00:00.000Z",
  "title": "Разработка модуля",
  "description": "Описание выполненной работы",
  "artifact_link": "https://github.com/example/pr",
  "updated_at": "2026-08-03T12:00:00.000Z"
  }
  ]

### **GET /tasks/week?weekStart=2026-08-03**

Получить задачи текущего пользователя за неделю.

- **Query:**
  - `weekStart` — дата начала недели

- **Response (200 OK):**
  {
  "weekStart": "2026-08-03T00:00:00.000Z",
  "weekEnd": "2026-08-10T00:00:00.000Z",
  "practiceStart": "2026-08-01T00:00:00.000Z",
  "practiceEnd": "2026-08-31T00:00:00.000Z",
  "tasks": []
  }

- **Ошибки:**
  - 400 Bad Request — { "message": "weekStart is required" }
  - 400 Bad Request — { "message": "Invalid weekStart" }

### **PATCH /tasks/:id**

Обновить свою карточку задачи.

- **Body (любое подмножество):**
  {
  "date": "2026-08-04T00:00:00.000Z",
  "title": "Новое название",
  "description": "Новое описание",
  "artifact_link": null
  }

- **Response (200 OK):** обновленная карточка задачи

- **Ошибки:**
  - 404 Not Found — { "message": "Task not found" }

### **DELETE /tasks/:id**

Удалить свою карточку задачи.

- **Response (200 OK):**
  {
  "message": "Task deleted"
  }

- **Ошибки:**
  - 404 Not Found — { "message": "Task not found" }

### **GET /tasks/all**

Получить все задачи участников активной когорты.

- **Роль:** ADMIN

- **Response (200 OK):**
  [
  {
  "id": "uuid",
  "user_id": "uuid",
  "cohort_id": "uuid",
  "date": "2026-08-03T00:00:00.000Z",
  "title": "Разработка модуля",
  "description": "Описание",
  "artifact_link": "https://github.com/example/pr",
  "updated_at": "2026-08-03T12:00:00.000Z",
  "user": {
  "id": "uuid",
  "email": "student@example.com"
  }
  }
  ]

### **GET /tasks/all/week?weekStart=2026-08-03**

Получить все задачи участников активной когорты за неделю.

- **Роль:** ADMIN

- **Query:**
  - `weekStart` — дата начала недели

- **Response (200 OK):**
  {
  "weekStart": "2026-08-03T00:00:00.000Z",
  "weekEnd": "2026-08-10T00:00:00.000Z",
  "practiceStart": "2026-08-01T00:00:00.000Z",
  "practiceEnd": "2026-08-31T00:00:00.000Z",
  "tasks": []
  }

## **Admin**

---

_Владелец: Backend Developer №2_

_Статус: реализовано (Этап 10)_

Все эндпоинты требуют `Authorization: Bearer <JWT>`, роль `ADMIN` и активную когорту (`req.cohortId`). Все данные фильтруются по активной когорте.

### **GET /admin/students**

Получить список студентов с одобренной заявкой в активной когорте.

- **Роль:** ADMIN
- **Response (200 OK):**
  [
  {
  "id": "application-id",
  "status": "APPROVED",
  "created_at": "2026-07-06T00:00:00.000Z",
  "review_comment": null,
  "user_id": "user-id",
  "cohort_id": "cohort-id",
  "role_id": "role-id",
  "user": {
  "id": "user-id",
  "email": "student@example.com"
  },
  "role": {
  "id": "role-id",
  "name": "Backend"
  }
  }
  ]

### **GET /admin/documents**

Получить список одобренных студентов активной когорты с документными данными и readiness по документам.

- **Роль:** ADMIN
- **Response (200 OK):**
  [
  {
  "application_id": "application-id",
  "user_id": "user-id",
  "user": {
  "id": "user-id",
  "email": "student@example.com"
  },
  "role": {
  "id": "role-id",
  "name": "Backend"
  },
  "documents": null,
  "readiness": {
  "individual_task": {
  "ready": false,
  "missingFields": ["student_fio", "group"]
  },
  "review": {
  "ready": false,
  "missingFields": ["review_activities"]
  },
  "title_page": {
  "ready": false,
  "missingFields": ["report_admin_approved"]
  }
  }
  }
  ]

### **GET /admin/documents/:userId**

Получить документы конкретного одобренного студента в активной когорте.

- **Роль:** ADMIN
- **Params:**
  - `userId` — id студента
- **Response (200 OK):**
  {
  "application_id": "application-id",
  "user_id": "user-id",
  "user": {
  "id": "user-id",
  "email": "student@example.com"
  },
  "role": {
  "id": "role-id",
  "name": "Backend"
  },
  "documents": null,
  "readiness": {
  "individual_task": {
  "ready": false,
  "missingFields": ["student_fio", "group"]
  },
  "review": {
  "ready": false,
  "missingFields": ["review_activities"]
  },
  "title_page": {
  "ready": false,
  "missingFields": ["report_admin_approved"]
  }
  }
  }
- **Ошибки:**
  - 404 Not Found — { "message": "Approved student not found" }

### **GET /admin/tasks**

Получить задачи всех одобренных студентов активной когорты.

- **Роль:** ADMIN
- **Response (200 OK):**
  [
  {
  "application_id": "application-id",
  "user_id": "user-id",
  "user": {
  "id": "user-id",
  "email": "student@example.com"
  },
  "role": {
  "id": "role-id",
  "name": "Backend"
  },
  "tasks": [
  {
  "id": "task-id",
  "user_id": "user-id",
  "cohort_id": "cohort-id",
  "date": "2026-08-03T00:00:00.000Z",
  "title": "Разработка модуля",
  "description": "Описание работы",
  "artifact_link": "https://github.com/example/pr",
  "updated_at": "2026-08-03T12:00:00.000Z"
  }
  ]
  }
  ]

### **GET /admin/stats**

Получить общую статистику активной когорты.

- **Роль:** ADMIN
- **Response (200 OK):**
  {
  "applications": {
  "total": 10,
  "pending": 2,
  "approved": 7,
  "rejected": 1
  },
  "documents": {
  "totalRecords": 7,
  "uploadedReports": 4,
  "approvedReports": 3
  },
  "tasks": {
  "total": 25
  }
  }

## Модуль: Когорты (Cohorts)

Базовый URL: `/api/v1/cohorts`
Все эндпоинты модуля требуют обязательной авторизации через заголовок:
`Authorization: Bearer <JWT_TOKEN>`

---

### 1. Создание / Обновление когорты (POST / PATCH)

Используется для инициализации или редактирования параметров учебного потока.

- **URL:** `/` (или `/:id` для PATCH)
- **Метод:** `POST` | `PATCH`
- **Формат тела запроса (JSON):**

```json
{
  "name": "Весна 2026",
  "application_start": "2026-03-01T00:00:00.000Z",
  "application_end": "2026-04-15T23:59:59.000Z",
  "practice_start": "2026-05-01T00:00:00.000Z",
  "practice_end": "2026-07-01T23:59:59.000Z"
}
```

#### Успешный ответ (200 OK / 21 Created)

JSON

```
{
  "success": true,
  "data": {
    "id": "clxb123450000ud8vun",
    "name": "Весна 2026",
    "application_start": "2026-03-01T00:00:00.000Z",
    "application_end": "2026-04-15T23:59:59.000Z",
    "practice_start": "2026-05-01T00:00:00.000Z",
    "practice_end": "2026-07-01T23:59:59.000Z"
  }
}
```

#### Ошибка валидации данных (400 Bad Request)

Возвращается, если нарушена структура DTO или логика дат (например, дата окончания раньше даты начала).

JSON

```
{
  "success": false,
  "errors": [
    "Дата окончания приема заявок (application_end) должна быть позже даты начала (application_start).",
    "Дата окончания практики (practice_end) должна быть позже даты начала практики (practice_start)."
  ]
}
```

### 2. Получение активной когорты текущего пользователя

Определяет контекст текущего авторизованного студента/ментора на основе его профиля в БД.

- **URL:** `/active/me`
- **Метод:** `GET`

#### Успешный ответ (200 OK)

JSON

```
{
  "success": true,
  "cohortId": "clxb123450000ud8vun"
}
```

_Примечание: Если у пользователя не выбрана или отсутствует активная когорта, `cohortId` вернет `null`._

#### Ошибка сервера (500 Internal Server Error)

Возвращается при непредвиденных сбоях базы данных (перехвачено через try/catch мидлвары).

JSON

```
{
  "success": false,
  "message": "Внутренняя ошибка сервера при обработке контекста когорты."
}
```

## **TestTask (Тестовые задания)**

---

_Владелец: Backend Developer №1_

Модуль предназначен для управления тестовыми заданиями в рамках конкретной когорты. Доступ к контенту заданий жестко разграничен в зависимости от роли пользователя и статуса его заявки (`Application`).

---

### **1. Получение списка тестовых заданий когорты**

Возвращает список тестовых заданий для текущей когорты (определяется через контекст `req.cohortId`).

- **URL:** `/test-task`
- **Метод:** `GET`
- **Авторизация:** Требуется (Bearer токен в заголовок `Authorization`)
- **Доступ:** `ADMIN` (видит всё), `STUDENT` (только если подана анкета)

#### Поведение для роли ADMIN:

Возвращает полный массив заданий с открытым контентом, независимо от того, опубликованы они или нет.

**Response (200 OK):**

```json
[
  {
    "id": "clxb123450000ud8vun",
    "cohort_id": "clxb123450000ud8abc",
    "content": "Реализуйте бэкенд на Express и Prisma v7 согласно ТЗ.",
    "published_at": "2026-07-08T12:00:00.000Z"
  },
  {
    "id": "clxb987650000ud8vun",
    "cohort_id": "clxb123450000ud8abc",
    "content": "Черновик нового задания",
    "published_at": null
  }
]
```

#### Поведение для роли STUDENT:

- **Если анкета (`Application`) НЕ подана:** Возвращает ошибку `403 Forbidden`.
- **Если анкета подана, но задание НЕ опубликовано:** Возвращает метаданные, но скрывает текст задания (`content: null`), а флаг `is_published` равен `false` (сигнал фронтенду показать заглушку «Задание появится позже»).
- **Если задание опубликовано:** Возвращает полные данные задания.

**Response для STUDENT (200 OK, задание не опубликовано):**

JSON

```
[
  {
    "id": "clxb123450000ud8vun",
    "cohort_id": "clxb123450000ud8abc",
    "content": null,
    "published_at": null,
    "is_published": false
  }
]
```

**Response для STUDENT (200 OK, задание опубликовано):**

JSON

```
[
  {
    "id": "clxb123450000ud8vun",
    "cohort_id": "clxb123450000ud8abc",
    "content": "Реализуйте бэкенд на Express и Prisma v7 согласно ТЗ.",
    "published_at": "2026-07-08T12:00:00.000Z",
    "is_published": true
  }
]
```

**Response (403 Forbidden — анкета не заполнена):**

JSON

```
{
  "error": "Тестовое задание станет доступно только после отправки анкеты"
}
```

### **2. Создание тестового задания**

Создает новое тестовое задание в контексте текущей когорты.

- **URL:** `/test-task`
- **Метод:** `POST`
- **Авторизация:** Требуется (Bearer токен)
- **Доступ:** Только `ADMIN`
- **Body:**
  JSON
  ```
  {
    "content": "Текст нового тестового задания для отбора кандидатов."
  }
  ```

#### Успешный ответ (201 Created)

JSON

```
{
  "id": "clxb123450000ud8vun",
  "cohort_id": "clxb123450000ud8abc",
  "content": "Текст нового тестового задания для отбора кандидатов.",
  "published_at": null
}
```

### **3. Редактирование контента задания**

Позволяет изменить исключительно текстовое содержимое задания. Не влияет на дату публикации.

- **URL:** `/test-task/:id`
- **Метод:** `PATCH`
- **Авторизация:** Требуется (Bearer токен)
- **Доступ:** Только `ADMIN`
- **Body:**
  JSON
  ```
  {
    "content": "Обновленный текст тестового задания."
  }
  ```

#### Успешный ответ (200 OK)

JSON

```
{
  "id": "clxb123450000ud8vun",
  "cohort_id": "clxb123450000ud8abc",
  "content": "Обновленный текст тестового задания.",
  "published_at": null
}
```

#### Ошибка (404 Not Found — если ID не существует или принадлежит чужой когорте)

JSON

```
{
  "error": "Задание не найдено или у вас нет прав на его изменение"
}
```

### **4. Публикация тестового задания**

Разовое действие, фиксирующее время публикации задания на сервере (`published_at`). Идемпотентно (повторный вызов вернет ошибку).

- **URL:** `/test-task/:id/publish`
- **Метод:** `POST`
- **Авторизация:** Требуется (Bearer токен)
- **Доступ:** Только `ADMIN`
- **Body:** Отсутствует

#### Успешный ответ (200 OK)

JSON

```
{
  "id": "clxb123450000ud8vun",
  "cohort_id": "clxb123450000ud8abc",
  "content": "Обновленный текст тестового задания.",
  "published_at": "2026-07-08T12:05:00.000Z"
}
```

#### Ошибка (400 Bad Request — если задание уже было опубликовано ранее)

JSON

```
{
  "error": "Тестовое задание уже опубликовано"
}
```

### **5. Удаление тестового задания**

Удаляет задание из базы данных, если оно найдено в рамках текущей когорты.

- **URL:** `/test-task/:id`
- **Метод:** `DELETE`
- **Авторизация:** Требуется (Bearer токен)
- **Доступ:** Только `ADMIN`

#### Успешный ответ (200 OK)

JSON

```
{
  "message": "Тестовое задание успешно удалено"
}
```

#### Ошибка (404 Not Found — если ID задания не найден в текущей когорте)

JSON

```
{
  "error": "Задание не найдено или у вас нет прав на его удаление"
}
```

## Модуль Survey (Конструктор анкет)

Все эндпоинты данного модуля автоматически работают в контексте активной когорты, которая извлекается из токена авторизации (`req.cohortId`). Прямая передача `cohort_id` в теле запроса или query-параметрах запрещена.

### 1. POST /api/survey-fields — Создать поле анкеты

- **Доступ:** Администратор (`ADMIN`)
- **Headers:** `Authorization: Bearer <token>`
- **Request Body (JSON):**

```json
{
  "label": "Укажите ваш опыт в разработке (лет/месяцев)",
  "type": "TEXT", // Допустимые типы: TEXT, TEXTAREA, SELECT, CHECKBOX
  "required": true,
  "order": 1,
  "options": null // Массив строк для SELECT/CHECKBOX, например: ["0-1 год", "1-3 года"]
}
```

- **Response (201 Created):**

JSON

```
{
  "success": true,
  "data": {
    "id": "clxb123450000ud83jsh292js",
    "cohort_id": "clx7890120000ud83jsh292js",
    "label": "Укажите ваш опыт в разработке (лет/месяцев)",
    "type": "TEXT",
    "required": true,
    "options": null,
    "order": 1,
    "created_at": "2026-07-08T00:00:00.000Z",
    "updated_at": "2026-07-08T00:00:00.000Z"
  }
}
```

### 2. GET /api/survey-fields — Получить список полей анкеты

- **Доступ:** Публичный / Студент / Админ (зависит от контекста текущей активной когорты приема)
- **Description:** Возвращает все вопросы анкеты для текущей когорты, строго отсортированные по полю `order` по возрастанию.
- **Response (200 OK):**

JSON

```
{
  "success": true,
  "data": [
    {
      "id": "clxb123450000ud83jsh292js",
      "label": "Укажите ваш опыт в разработке (лет/месяцев)",
      "type": "TEXT",
      "required": true,
      "options": null,
      "order": 1
    }
  ]
}
```

### 3. GET /api/survey-fields/:id — Получить одно поле по ID

- **Доступ:** Администратор (`ADMIN`)
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** Полный объект поля (аналогично ответу POST).
- **Response (444 Not Found / Context Error):** Если поле не найдено или принадлежит чужой когорте.

JSON

```
{
  "success": false,
  "errors": ["Поле анкеты не найдено в текущей когорте"]
}
```

### 4. PATCH /api/survey-fields/:id — Редактировать поле анкеты

- **Доступ:** Администратор (`ADMIN`)
- **Headers:** `Authorization: Bearer <token>`
- **Request Body (JSON):** Любые поля из модели `SurveyField` частично.

JSON

```
{
  "label": "Обновленный текст вопроса",
  "order": 2
}
```

- **Response (200 OK):** Обновленный объект поля.

### 5. DELETE /api/survey-fields/:id — Удалить поле анкеты

- **Доступ:** Администратор (`ADMIN`)
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**

JSON

```
{
  "success": true,
  "message": "Поле анкеты успешно удалено"
}
```

## Модуль Application (Заявки студентов)

### 1. GET /api/applications/form — Получить форму анкеты с автоподстановкой

- **Доступ:** Студент (`STUDENT`)
- **Headers:** `Authorization: Bearer <token>`
- **Description:** Эндпоинт для отрисовки формы на фронтенде. Возвращает конфигурацию полей когорты. Если студент уже сохранял анкету ранее, в ключе `existingAnswer` вернется строка с ответом, иначе — `null`.
- **Response (200 OK):**

JSON

```
{
  "success": true,
  "data": {
    "application_id": "clxc987650000ud83jsh292js", // null, если еще не подавал вообще
    "status": "PENDING", // null, если еще не подавал
    "review_comment": null,
    "fields": [
      {
        "id": "clxb123450000ud83jsh292js",
        "label": "Укажите ваш опыт в разработке (лет/месяцев)",
        "type": "TEXT",
        "options": null,
        "order": 1,
        "existingAnswer": "1 год и 2 месяца" // Текст ответа, либо null
      }
    ]
  }
}
```

### 2. POST /api/applications — Подать или перезаполнить заявку

- **Доступ:** Студент (`STUDENT`)
- **Headers:** `Authorization: Bearer <token>`
- **Description:** Массово сохраняет ответы. Реализует логику атомарного перезаполнения (старые ответы стираются, статус сбрасывается в `PENDING`). Если заявка уже одобрена (`APPROVED`), возвращает ошибку блокировки.
- **Request Body (JSON):**

JSON

```
{
  "answers": [
    {
      "field_id": "clxb123450000ud83jsh292js",
      "value": "Новый текст ответа взамен старого"
    }
  ]
}
```

- **Response (201 Created):**

JSON

```
{
  "success": true,
  "data": {
    "id": "clxc987650000ud83jsh292js",
    "user_id": "clxuser1230000ud83jsh292js",
    "cohort_id": "clx7890120000ud83jsh292js",
    "status": "PENDING",
    "review_comment": null,
    "created_at": "2026-07-08T01:10:00.000Z",
    "answers": [
      {
        "id": "clxans0000000ud83jsh292js",
        "application_id": "clxc987650000ud83jsh292js",
        "field_id": "clxb123450000ud83jsh292js",
        "value": "Новый текст ответа взамен старого"
      }
    ]
  }
}
```

- **Response (403 Forbidden — Заявка уже принята):**

JSON

```
{
  "success": false,
  "errors": ["Редактирование одобренной заявки запрещено"]
}
```

### 3. GET /api/applications/my — Просмотр своей заявки студентом

- **Доступ:** Студент (`STUDENT`)
- **Headers:** `Authorization: Bearer <token>`
- **Description:** Используется для вывода деталей отправленной заявки в личном кабинете.
- **Response (200 OK):**

JSON

```
{
  "success": true,
  "data": {
    "id": "clxc987650000ud83jsh292js",
    "status": "PENDING",
    "review_comment": null,
    "answers": [
      {
        "id": "clxans0000000ud83jsh292js",
        "value": "Новый текст ответа взамен старого",
        "field": {
          "id": "clxb123450000ud83jsh292js",
          "label": "Укажите ваш опыт в разработке (лет/месяцев)",
          "type": "TEXT"
        }
      }
    ]
  }
}
```

### 4. GET /api/applications/:id — Детальный просмотр заявки админом

- **Доступ:** Администратор (`ADMIN`)
- **Headers:** `Authorization: Bearer <token>`
- **Description:** Карточка заявки для панели управления. Включает базовую информацию о студенте (без хэша пароля). Строго изолировано в рамках активной когорты админа.
- **Response (200 OK):**

JSON

```
{
  "success": true,
  "data": {
    "id": "clxc987650000ud83jsh292js",
    "status": "PENDING",
    "review_comment": null,
    "user": {
      "id": "clxuser1230000ud83jsh292js",
      "email": "student@urfu.me",
      "created_at": "2026-06-01T12:00:00.000Z"
    },
    "answers": [
      {
        "id": "clxans0000000ud83jsh292js",
        "value": "Новый текст ответа взамен старого",
        "field": {
          "label": "Укажите ваш опыт в разработке (лет/месяцев)",
          "type": "TEXT"
        }
      }
    ]
  }
}
```

- **Response (404 Not Found):** Если заявки не существует или она находится в другой когорте (чтобы скрыть сам факт её существования).

JSON

```
{
  "success": false,
  "errors": ["Заявка не найдена"]
}
```

````

### Куда вставлять:
Открывай файл `docs/api-contract.md`, прокручивай в самый низ, ставь разделитель `---` и вставляй этот блок. Как только сохранишь, можешь сделать быстрый коммит документации:
```bash
git add docs/api-contract.md
git commit -m "docs: update api-contract with Survey and Application modules specs"
git push origin main
````

## **Шаблон для нового эндпоинта**

---

\#\#\# \`METHOD /path\`  
Краткое описание.

\- Авторизация / роль: ...  
\- Предусловия: ...  
\- Body: ...  
\- Query: ...  
\- Response: ...  
\- Ошибки: ...
