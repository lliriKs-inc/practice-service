# Записка фронтенду: Cohort API подключён

Дата: 2026-07-14

Пробел, найденный во время F-06, закрыт в ветке `cohort-api-complete`. Backend теперь предоставляет admin API под `/api/v1` для списка и detail когорты, редактирования и переходов статуса, треков, survey/questions и invitation lifecycle. Центральный API contract и route inventory обновлены.

## Что использовать

- `GET/POST /cohorts`;
- `GET/PATCH /cohorts/:cohortId`;
- `PATCH /cohorts/:cohortId/activate` и `/close`;
- `GET/POST/PATCH/DELETE /cohorts/:cohortId/tracks/...`;
- `GET/POST /cohorts/:cohortId/survey` и операции questions;
- `POST /cohorts/:cohortId/invitation` и `/regenerate`;
- `DELETE /cohorts/:cohortId/invitation`.

`frontend/src/services/api/cohorts.ts` уже переведён на реальные запросы. Сохранение draft выполняет diff относительно server state и применяет изменения через API. Для создания когорты UI запрашивает отдельные даты окна подачи заявок и практики.

## Инструкция для отдельной frontend-ветки

1. Не выполняй `git pull origin main`: это не нужно для получения backend-изменений.
2. Получи именно backend-коммит или согласованную integration branch и примени его через `cherry-pick`/merge по договорённости команды.
3. Убедись, что `NEXT_PUBLIC_API_URL` указывает на versioned base, например `http://localhost:3001/api/v1`.
4. Проверь под ADMIN list/detail/create/update/status transition/track CRUD/survey question CRUD/invitation lifecycle.
5. Проверь ошибки `401`, `403`, `404`, `409`, особенно удаление track с applications и активацию cohort без application window.
6. После восстановления frontend-зависимостей запусти `npm run typecheck`, `npm test` и `npm run build`.

Старые mock helper-функции, используемые существующими candidate/test-task component tests, не являются источником данных для admin cohort workspace. Их можно удалить отдельным cleanup-коммитом после перевода зависимых candidate flows на реальный API.
