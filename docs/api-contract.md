# **API Contract — Сервис «Практика»**

*Единый источник правды по всем backend-эндпоинтам.*

**Правила редактирования:**

* Backend Developer №1 редактирует разделы: **Auth, Cohorts, CohortRole, Survey, Application, TestTask**  
* Backend Developer №2 редактирует разделы: **Documents, Tasks, Admin**  
* Frontend **не редактирует** этот файл, только читает  
* Каждый новый/изменённый эндпоинт добавляется в контракт **в том же PR**, где он реализован  
* Формат описания эндпоинта — см. шаблон в конце файла

**Base URL:** http://localhost:\<PORT\> (см. .env.example)

**Авторизация:** большинство эндпоинтов требуют заголовок Authorization: Bearer \<JWT\>. Публичные исключения помечены явно.

**Общий формат ошибки:**

{  
  "message": "Текст ошибки"  
}

## **Auth**

---

*Владелец: Backend Developer №1*

### **POST /auth/register**

Регистрация нового пользователя.

* **Авторизация:** не требуется  
* **Body:**  
  {  
    "email": "user@example.com",  
    "password": "strongpassword123"  
  }  
* **Response (210 Created):**  
  {  
    "id": "uuid-строка",  
    "email": "user@example.com"  
  }  
* **Ошибки:**  
  * 400 Bad Request — { "message": "Невалидный email или слишком короткий пароль" }  
  * 409 Conflict — { "message": "Пользователь с таким email уже существует" }

### **POST /auth/login**

Получить JWT.

* **Авторизация:** не требуется  
* **Body:**  
  {  
    "email": "admin@test.com",  
    "password": "123456"  
  }  
* **Response (200 OK):**  
  {  
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  
  }  
* **Ошибки:**  
  * 401 Unauthorized — { "message": "Неверный email или пароль" }

### **GET /auth/me**

Получить текущего пользователя по токену.

* **Авторизация:** требуется  
* **Response (200 OK):**  
  {  
    "id": "uuid-строка",  
    "email": "user@test.com",  
    "role": "USER",  
    "active\_cohort\_id": "uuid-когорты-или-null"  
  }  
* **Ошибки:**  
  * 401 Unauthorized — { "message": "Токен отсутствует или невалиден" }

## **Cohorts**

---

*Владелец: Backend Developer №1*

Все /cohorts... эндпоинты требуют авторизацию. Создание/редактирование/активация — только ADMIN.

### **POST /cohorts**

Создать когорту.

* **Роль:** ADMIN  
* **Body:**  
  {  
    "name": "2026-test",  
    "application\_start": "2026-07-01T00:00:00.000Z",  
    "application\_end": "2026-07-15T00:00:00.000Z",  
    "practice\_start": "2026-08-01T00:00:00.000Z",  
    "practice\_end": "2026-08-31T00:00:00.000Z"  
  }  
* **Response (210 Created):**  
  {  
    "id": "uuid-строка",  
    "name": "2026-test",  
    "application\_start": "2026-07-01T00:00:00.000Z",  
    "application\_end": "2026-07-15T00:00:00.000Z",  
    "practice\_start": "2026-08-01T00:00:00.000Z",  
    "practice\_end": "2026-08-31T00:00:00.000Z"  
  }

### **GET /cohorts**

Список всех когорт.

* **Response (200 OK):**  
  \[  
    {  
      "id": "uuid-1",  
      "name": "2026-test",  
      "application\_start": "2026-07-01T00:00:00.000Z",  
      "application\_end": "2026-07-15T00:00:00.000Z",  
      "practice\_start": "2026-08-01T00:00:00.000Z",  
      "practice\_end": "2026-08-31T00:00:00.000Z"  
    }  
  \]

### **GET /cohorts/:id**

Получить одну когорту по id.

* **Response (200 OK):**  
  {  
    "id": "uuid-строка",  
    "name": "2026-test",  
    "application\_start": "2026-07-01T00:00:00.000Z",  
    "application\_end": "2026-07-15T00:00:00.000Z",  
    "practice\_start": "2026-08-01T00:00:00.000Z",  
    "practice\_end": "2026-08-31T00:00:00.000Z"  
  }  
* **Ошибки:**  
  * 404 Not Found — { "message": "Когорта не найдена" }

### **PATCH /cohorts/:id**

Частично обновить когорту.

* **Роль:** ADMIN  
* **Body (пример подмножества полей):**  
  {  
    "name": "2026-updated",  
    "practice\_end": "2026-09-05T00:00:00.000Z"  
  }  
* **Response (200 OK):**  
  {  
    "id": "uuid-строка",  
    "name": "2026-updated",  
    "application\_start": "2026-07-01T00:00:00.000Z",  
    "application\_end": "2026-07-15T00:00:00.000Z",  
    "practice\_start": "2026-08-01T00:00:00.000Z",  
    "practice\_end": "2026-09-05T00:00:00.000Z"  
  }

### **POST /cohorts/:id/activate**

Выбрать активную когорту для текущего админа (записывается в User.active\_cohort\_id).

* **Роль:** ADMIN  
* **Response (200 OK):**  
  {  
    "message": "Когорта успешно активирована",  
    "active\_cohort\_id": "uuid-активированной-когорты"  
  }  
* **Ошибки:**  
  * 404 Not Found — { "message": "Когорта не найдена" }

### **GET /cohorts/active/me**

Получить активную когорту текущего пользователя.

* **Response (200 OK):**  
  {  
    "active\_cohort\_id": "uuid-строка-или-null"  
  }

**Важно (для всех будущих модулей):** после authMiddleware работает cohortContextMiddleware, который кладёт req.cohortId на основе User.active\_cohort\_id. Все операции с сущностями, привязанными к когорте, должны использовать req.cohortId, а не cohort\_id из body/query.

## **CohortRole**

---

*Владелец: Backend Developer №1*

Роуты подключены **раньше** /cohorts/:id, чтобы /cohorts/roles не перехватывался как параметр :id.

### **POST /cohorts/roles**

Создать роль/трек в активной когорте.

* **Роль:** ADMIN  
* **Предусловие:** активная когорта выбрана (POST /cohorts/:id/activate)  
* **Body:**  
  {  
    "name": "Backend"  
  }  
* **Response (210 Created):**  
  {  
    "id": "uuid-роли",  
    "name": "Backend",  
    "cohort\_id": "uuid-активной-когорты"  
  }  
* **Ошибки:**  
  * 400 Bad Request — { "message": "No active cohort selected" }

### **GET /cohorts/roles**

Получить роли только активной когорты.

* **Response (200 OK):**  
  \[  
    {  
      "id": "uuid-1",  
      "name": "Backend",  
      "cohort\_id": "uuid-активной-когорты"  
    },  
    {  
      "id": "uuid-2",  
      "name": "Frontend",  
      "cohort\_id": "uuid-активной-когорты"  
    }  
  \]  
* **Ошибки:**  
  * 400 Bad Request — { "message": "No active cohort selected" }

## **Survey**

---

*Владелец: Backend Developer №1*

*Статус: не реализовано (Этап 5, 0%)*

Планируемые эндпоинты:

* POST /survey-fields — создать поле анкеты  
* GET /survey-fields — список полей активной когорты (сортировка по order)  
* GET /survey-fields/:id — одно поле  
* PATCH /survey-fields/:id — редактирование  
* DELETE /survey-fields/:id — удаление

## **Application**

---

*Владелец: Backend Developer №1*

*Статус: не реализовано (Этап 5–6, 0%)*

Планируемые эндпоинты:

* POST /applications — подать заявку  
* GET /applications/my — заявка текущего пользователя в активной когорте  
* GET /applications/:id — просмотр заявки  
* GET /applications — список всех заявок активной когорты (ADMIN)  
* PATCH /applications/:id/approve — одобрить \+ назначить роль  
* PATCH /applications/:id/reject — отклонить  
* PATCH /applications/:id — комментарий администратора

**Важно для Dev №2 / Frontend:** доступ к Documents и Tasks проверяется через наличие записи со статусом APPROVED в этой когорте.

## **TestTask**

---

*Владелец: Backend Developer №1*

*Статус: не реализовано (Этап 5, 0%)*

* POST /test-task — создать тестовое задание  
* GET /test-task — список заданий активной когорты  
* PATCH /test-task/:id — редактирование  
* DELETE /test-task/:id — удаление

## **Documents**

---

*Владелец: Backend Developer №2*

*Статус: реализовано (Этап 8\)*

### **GET /documents**

Данные документов текущего пользователя в активной когорте.

* **Response:** TODO — уточнить точную форму объекта StudentDocumentData  
* **Ошибки:**  
  { "message": "Unauthorized" }  
  { "message": "No active cohort selected" }  
  { "message": "Application not approved" }

### **POST /documents**

Создаёт/инициализирует запись StudentDocumentData (upsert по user\_id \+ cohort\_id).

### **PATCH /documents**

Обновляет поля, заполняемые студентом.

* **Body (любое подмножество):**  
  {  
    "student\_fio": "string",  
    "group": "string",  
    "direction\_code": "string",  
    "direction\_name": "string",  
    "program\_name": "string",  
    "specialty": "string",  
    "practice\_topic": "string",  
    "main\_stage\_tasks": "string"  
  }

### **POST /documents/report**

Загрузка файла отчёта.

* **Content-Type:** multipart/form-data  
* **Поле формы:** report (допустимые форматы: pdf, doc, docx, макс 10 MB)  
* **Результат:** report\_file\_url \= /uploads/\<filename\>

### **PATCH /documents/review**

Заполнение полей отзыва администратором.

* **Роль:** ADMIN  
* **Body:**  
  {  
    "userId": "string",  
    "review\_activities": "string",  
    "review\_characteristic": "string",  
    "review\_employed": "string",  
    "review\_next\_practice": "string",  
    "review\_employment\_offer": "string",  
    "review\_suggestions": "string",  
    "review\_grade": "string"  
  }

### **PATCH /documents/approve**

Подтверждение отчёта администратором.

### **GET /documents/readiness**

Готовность трёх документов к формированию.

* **Response (200 OK):**  
  {  
    "individual\_task": {  
      "ready": false,  
      "missingFields": \["student\_fio", "group"\]  
    },  
    "review": {  
      "ready": false,  
      "missingFields": \["review\_activities"\]  
    },  
    "title\_page": {  
      "ready": false,  
      "missingFields": \["report\_admin\_approved"\]  
    }  
  }

### **GET /documents/generate/:type**

Генерация и скачивание DOCX (individual-task, review, title-page).

## **Tasks**

---

*Владелец: Backend Developer №2*

*Статус: не реализовано (Этап 9, 0%)*

* POST /tasks — создать карточку задачи  
* GET /tasks — задачи текущего пользователя в активной когорте  
* PATCH /tasks/:id — редактирование  
* DELETE /tasks/:id — удаление

## **Admin**

---

*Владелец: Backend Developer №2*

*Статус: не реализовано (Этап 10, 0%)*

Все эндпоинты требуют роль ADMIN и фильтрацию по активной когорте.

* GET /admin/students — список одобренных студентов  
* GET /admin/stats — общая статистика по когорте

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