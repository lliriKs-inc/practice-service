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

- **Response:** TODO — уточнить точную форму объекта StudentDocumentData
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

_Статус: не реализовано (Этап 10, 0%)_

Все эндпоинты требуют роль ADMIN и фильтрацию по активной когорте.

- GET /admin/students — список одобренных студентов
- GET /admin/stats — общая статистика по когорте



## Модуль: Когорты (Cohorts)

Базовый URL: `/api/v1/cohorts`
Все эндпоинты модуля требуют обязательной авторизации через заголовок:
`Authorization: Bearer <JWT_TOKEN>`

---

### 1. Создание / Обновление когорты (POST / PATCH)

Используется для инициализации или редактирования параметров учебного потока.

* **URL:** `/` (или `/:id` для PATCH)
* **Метод:** `POST` | `PATCH`
* **Формат тела запроса (JSON):**

```json
{
  "name": "Весна 2026",
  "application_start": "2026-03-01T00:00:00.000Z",
  "application_end": "2026-04-15T23:59:59.000Z",
  "practice_start": "2026-05-01T00:00:00.000Z",
  "practice_end": "2026-07-01T23:59:59.000Z"
}
````

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
