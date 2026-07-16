# Documents API

Все пути ниже доступны с production prefix `/api/v1` и требуют JWT. Student endpoints проверяют владельца approved application; admin endpoints требуют роль `ADMIN` и ограничивают заявку через `Application.track.cohort_id`.

Центральный frozen contract и полный route inventory находятся в `docs/api-contract.md`.

## Readiness и EAV autosave

- `GET /me/applications/:applicationId/documents/readiness` — readiness для `INDIVIDUAL_TASK`, `TITLE_PAGE`, `REVIEW`, `NOTICE`.
- `GET /me/applications/:applicationId/documents` — EAV-значения и безопасная metadata документов.
- `PUT /me/applications/:applicationId/documents/:type/fields/:fieldKey` — autosave student-owned поля, body `{ "value": "..." }`.
- `PUT /cohorts/:cohortId/admin/applications/:applicationId/documents/:type/fields/:fieldKey` — autosave admin-owned поля, включая поля `REVIEW`.

Для EAV endpoints `:type` передаётся как Prisma enum (`INDIVIDUAL_TASK`, `TITLE_PAGE`, `REVIEW`, `NOTICE`). Неверный владелец поля получает `403`.

## Report workflow

- `GET /me/applications/:applicationId/report` — безопасная metadata отчёта.
- `PUT /me/applications/:applicationId/report` — замена multipart-файла в поле `report`.
- `PATCH /cohorts/:cohortId/applications/:applicationId/report/status` — решение ADMIN.
- `GET /me/applications/:applicationId/report/file` — скачивание владельцем.
- `GET /cohorts/:cohortId/admin/applications/:applicationId/report/file` — cohort-scoped скачивание ADMIN.

Статусы отчёта: `PENDING`, `APPROVED`, `REJECTED`. Замена файла сбрасывает статус в `PENDING`. `file_url` наружу не возвращается.

## DOCX generation

`POST /me/applications/:applicationId/documents/:type/generate` генерирует DOCX. `:type` принимает uppercase `DocumentType`: `INDIVIDUAL_TASK`, `TITLE_PAGE`, `REVIEW`, `NOTICE`.

Сгенерированный файл сохраняется через `StorageService`; повторная генерация заменяет предыдущий. Скачать его можно через:

- `GET /me/applications/:applicationId/documents/:type/file`;
- `GET /cohorts/:cohortId/admin/applications/:applicationId/documents/:type/file`.

Download endpoints принимают enum-тип документа и разрешают файл по resource ID, не раскрывая `generated_file_url`.
