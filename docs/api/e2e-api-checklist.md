# E2E API Checklist

This checklist describes the release smoke scenario for the backend API.

## Environment

- `baseUrl`: `http://localhost:3001`
- `adminToken`: token from admin login
- `studentToken`: token from student login
- `cohortId`: created cohort id
- `roleId`: created cohort role id
- `surveyFieldId`: created survey field id
- `applicationId`: created application id
- `studentId`: student user id
- `taskId`: created task id

## 1. Prepare Demo Context

### 1.1 Login as Admin

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json
```

```json
{
  "email": "admin@test.com",
  "password": "123456"
}
```

Expected result:

- `200 OK`
- Save response token as `adminToken`.

### 1.2 Create Cohort

```http
POST {{baseUrl}}/cohorts
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "name": "Practice 2026 E2E",
  "application_start": "2026-07-01T00:00:00.000Z",
  "application_end": "2026-07-31T23:59:59.000Z",
  "practice_start": "2026-08-01T00:00:00.000Z",
  "practice_end": "2026-08-31T23:59:59.000Z"
}
```

Expected result:

- `201 Created` or `200 OK`
- Save `id` as `cohortId`.

### 1.3 Activate Cohort for Admin

```http
POST {{baseUrl}}/cohorts/{{cohortId}}/activate
Authorization: Bearer {{adminToken}}
```

Expected result:

- `200 OK`
- Admin active cohort is updated.

### 1.4 Create Cohort Role

```http
POST {{baseUrl}}/cohorts/roles
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "name": "Backend"
}
```

Expected result:

- `201 Created` or `200 OK`
- Save `id` as `roleId`.

### 1.5 Create Survey Field

```http
POST {{baseUrl}}/survey-fields
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "label": "FIO",
  "type": "TEXT",
  "order": 1
}
```

Expected result:

- `201 Created` or `200 OK`
- Save `id` as `surveyFieldId`.

## 2. Application Flow

### 2.1 Register Student

```http
POST {{baseUrl}}/auth/register
Content-Type: application/json
```

```json
{
  "email": "student-e2e@test.com",
  "password": "12345678"
}
```

Expected result:

- `201 Created` or `200 OK`

### 2.2 Login as Student

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json
```

```json
{
  "email": "student-e2e@test.com",
  "password": "12345678"
}
```

Expected result:

- `200 OK`
- Save response token as `studentToken`.

### 2.3 Get Student Profile

```http
GET {{baseUrl}}/auth/me
Authorization: Bearer {{studentToken}}
```

Expected result:

- `200 OK`
- Save student `id` as `studentId`.

### 2.4 Ensure Student Active Cohort

The student must have `active_cohort_id` set to `cohortId`.

Current known limitation: cohort activation endpoint is admin-only, so this value may need to be set through seed/demo data or manually in the database during local E2E testing.

### 2.5 Get Application Form

```http
GET {{baseUrl}}/applications/form
Authorization: Bearer {{studentToken}}
```

Expected result:

- `200 OK`
- Response contains available roles and survey fields.

### 2.6 Submit Application

```http
POST {{baseUrl}}/applications
Authorization: Bearer {{studentToken}}
Content-Type: application/json
```

```json
{
  "answers": [
    {
      "field_id": "{{surveyFieldId}}",
      "value": "Ivanov Ivan Ivanovich"
    }
  ]
}
```

Expected result:

- `201 Created` or `200 OK`
- Save `id` as `applicationId`.

### 2.7 Approve Application

```http
PATCH {{baseUrl}}/applications/{{applicationId}}/approve
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "role_id": "{{roleId}}"
}
```

Expected result:

- `200 OK`
- Application status is `APPROVED`.

## 3. Documents Flow

### 3.1 Create Document Data Record

```http
POST {{baseUrl}}/documents
Authorization: Bearer {{studentToken}}
```

Expected result:

- `201 Created`

### 3.2 Update Individual Task Data

```http
PATCH {{baseUrl}}/documents
Authorization: Bearer {{studentToken}}
Content-Type: application/json
```

```json
{
  "student_fio": "Ivanov Ivan Ivanovich",
  "group": "RI-330948",
  "direction_code": "09.03.04",
  "direction_name": "Software Engineering",
  "program_name": "Software and Information Systems Development",
  "specialty": "09.03.04 Software Engineering",
  "practice_topic": "Development of an internship management service",
  "main_stage_tasks": "Configure backend API; integrate document modules; verify trainee task cards"
}
```

Expected result:

- `200 OK`

### 3.3 Check Individual Task Readiness

```http
GET {{baseUrl}}/documents/readiness
Authorization: Bearer {{studentToken}}
```

Expected result:

- `individual_task.ready` is `true`.

### 3.4 Generate Individual Task

```http
GET {{baseUrl}}/documents/generate/individual-task
Authorization: Bearer {{studentToken}}
```

Expected result:

- `200 OK`
- Response downloads `individual-task.docx`.

### 3.5 Update Review Data

```http
PATCH {{baseUrl}}/documents/review
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "userId": "{{studentId}}",
  "review_activities": "The student participated in backend module development and verification.",
  "review_characteristic": "The student showed confident TypeScript, Express and REST API skills.",
  "review_employed": "No",
  "review_next_practice": "Yes",
  "review_employment_offer": "Possible after graduation",
  "review_suggestions": "Continue improving integration testing skills.",
  "review_grade": "Excellent"
}
```

Expected result:

- `200 OK`

### 3.6 Generate Review

```http
GET {{baseUrl}}/documents/generate/review
Authorization: Bearer {{studentToken}}
```

Expected result:

- `200 OK`
- Response downloads `review.docx`.

### 3.7 Upload Practice Report

```http
POST {{baseUrl}}/documents/report
Authorization: Bearer {{studentToken}}
Content-Type: multipart/form-data
```

Form-data:

- `report`: `.pdf`, `.doc` or `.docx` file

Expected result:

- `200 OK`
- Response contains `report_file_url`.

### 3.8 Approve Report

```http
PATCH {{baseUrl}}/documents/approve
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "userId": "{{studentId}}"
}
```

Expected result:

- `200 OK`
- Response contains `Report approved`.

### 3.9 Check Full Documents Readiness

```http
GET {{baseUrl}}/documents/readiness
Authorization: Bearer {{studentToken}}
```

Expected result:

- `individual_task.ready` is `true`.
- `review.ready` is `true`.
- `title_page.ready` is `true`.

### 3.10 Generate Title Page

```http
GET {{baseUrl}}/documents/generate/title-page
Authorization: Bearer {{studentToken}}
```

Expected result:

- `200 OK`
- Response downloads `title-page.docx`.

## 4. Tasks Flow

### 4.1 Create Task

```http
POST {{baseUrl}}/tasks
Authorization: Bearer {{studentToken}}
Content-Type: application/json
```

```json
{
  "date": "2026-08-03T00:00:00.000Z",
  "title": "E2E Documents and Tasks verification",
  "description": "Verified approve flow, documents and task cards after application approval.",
  "artifact_link": "https://github.com/example/pr"
}
```

Expected result:

- `201 Created` or `200 OK`
- Save `id` as `taskId`.

### 4.2 Get Student Tasks

```http
GET {{baseUrl}}/tasks
Authorization: Bearer {{studentToken}}
```

Expected result:

- `200 OK`
- Response contains the created task.

### 4.3 Get Tasks by Week

```http
GET {{baseUrl}}/tasks/week?weekStart=2026-08-03
Authorization: Bearer {{studentToken}}
```

Expected result:

- `200 OK`
- Response contains the created task.

### 4.4 Update Task

```http
PATCH {{baseUrl}}/tasks/{{taskId}}
Authorization: Bearer {{studentToken}}
Content-Type: application/json
```

```json
{
  "title": "E2E Tasks API verification",
  "description": "Task creation, listing, weekly filtering and update work correctly.",
  "artifact_link": "https://github.com/example/pr/tasks-e2e"
}
```

Expected result:

- `200 OK`
- Response contains updated task data.

### 4.5 Validate Task Date Outside Practice Period

```http
POST {{baseUrl}}/tasks
Authorization: Bearer {{studentToken}}
Content-Type: application/json
```

```json
{
  "date": "2026-09-10T00:00:00.000Z",
  "title": "Task outside practice period",
  "description": "This request must fail because the date is outside the practice period.",
  "artifact_link": "https://github.com/example/outside-practice"
}
```

Expected result:

- `400 Bad Request`

## 5. Admin Flow

### 5.1 Get Approved Students

```http
GET {{baseUrl}}/admin/students
Authorization: Bearer {{adminToken}}
```

Expected result:

- `200 OK`
- Response contains approved student and assigned role.

### 5.2 Get Students Documents

```http
GET {{baseUrl}}/admin/documents
Authorization: Bearer {{adminToken}}
```

Expected result:

- `200 OK`
- Response contains student documents and readiness.

### 5.3 Get Student Documents by Id

```http
GET {{baseUrl}}/admin/documents/{{studentId}}
Authorization: Bearer {{adminToken}}
```

Expected result:

- `200 OK`
- Response contains the selected student's document data.

### 5.4 Get Student Tasks

```http
GET {{baseUrl}}/admin/tasks
Authorization: Bearer {{adminToken}}
```

Expected result:

- `200 OK`
- Response contains the created task card.

### 5.5 Get Admin Stats

```http
GET {{baseUrl}}/admin/stats
Authorization: Bearer {{adminToken}}
```

Expected result:

- `200 OK`
- Application, document and task counters include the E2E data.
