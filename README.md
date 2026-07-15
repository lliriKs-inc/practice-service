# **Документация проекта: Сервис «Практика» (README.md)**

Настоящий документ является единой точкой входа для разработчиков веб\-сервиса «Практика» — платформы для автоматизации, сопровождения и контроля производственных и преддипломных практик студентов. Документ регламентирует порядок локального развертывания, требования к качеству исходного кода и распределение зон ответственности в команде.

## **1\. Архитектура и структура монорепозитория**

Проект разработан по схеме монорепозитория, что позволяет централизованно управлять кодовой базой смежных сервисов, обеспечивая при этом строгую изоляцию контекстов исполнения бэкенда и фронтенда.

`├── backend/               # Серверная часть (Node.js, Express, TypeScript, Prisma v7)`  
`├── frontend/              # Клиентская часть (Next.js, TypeScript, shadcn/ui)`  
`├── docs/                  # API Contract, E2E checklist и техническая документация`
`├── docker-compose.yml     # Конфигурация контейнеризации инфраструктуры (PostgreSQL)`  
`├── .gitignore             # Глобальный файл исключений систем контроля версий`  
`└── README.md              # Настоящее руководство разработчика`

## **2\. Требования к системному окружению**

Для обеспечения идентичности сред выполнения на всех этапах разработки (разработка, тестирование, продакшн) локальная машина должна соответствовать следующим требованиям:

* **Node.js:** Среда выполнения JavaScript версии v22 LTS
* **Пакетный менеджер:** npm (поставляется в комплекте с Node.js)  
* **Контейнеризация:** Docker Desktop с поддержкой утилиты Docker Compose

## **3\. Пошаговое руководство по локальному развертыванию**

Следуйте приведенной ниже последовательности команд для развертывания проекта с нуля. Порядок выполнения шагов критически важен.

1. **Установка зависимостей в изолированных окружениях:**  
   Перейдите в каталоги бэкенда и фронтенда для установки локальных пакетов:  
   `cd backend\nnpm install\n\ncd ../frontend\nnpm install\ncd ..`  
2. **Конфигурация переменных окружения бэкенда:**  
   Создайте локальный конфигурационный файл среды на основе предоставленного шаблона:  
   `cp backend/.env.example backend/.env`  
   *Примечание: Обязательно верифицируйте строку подключения DATABASE\_URL и JWT\_SECRET в созданном файле .env.*  
3. **Оркестрация development-окружения:**
   Задайте `JWT_SECRET` длиной не менее 32 символов в корневом `.env` и запустите PostgreSQL, backend и frontend:
   `docker compose up -d`  
   Контейнерный frontend доступен на `http://localhost:3002`, backend — на `http://localhost:3001`.
4. **Применение схемы данных Prisma ORM v7:**  
   Накатите существующие миграции на запущенную БД и выполните генерацию типов Prisma Client:  
   `cd backend\nnpx prisma migrate dev`  
   Для наполнения базы данных первоначальными демонстрационными/системными данными выполните сидирование:  
   `npx prisma db seed`  
5. **Запуск сред разработки (Development Mode):**  
   Запуск бэкенд-сервера (по умолчанию доступен на порту 3000):
   `# Внутри папки backend/\nnpm run dev`  
   Запуск клиентской части на origin из `CORS_ORIGIN` (в отдельном окне терминала):
   `cd frontend\nnpm run dev -- -p 3001`

## **4. API и интеграционная документация**

Business API публикуется с общим prefix `/api/v1`. При стандартной локальной конфигурации base URL: `http://localhost:3000/api/v1`. Operational endpoints `/`, `/health` и `/ready` остаются без version prefix.

* **Центральный API Contract:** [`docs/api-contract.md`](docs/api-contract.md) — полный frozen route inventory, request/response, RBAC и errors.
* **E2E API checklist:** [`docs/e2e-api-checklist.md`](docs/e2e-api-checklist.md) — candidate, practice, admin, security и file scenarios.
* **Fragment docs:** `docs/api/` — дополнительный доменный контекст; центральный контракт имеет приоритет при расхождении.

Frontend transport должен либо использовать `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`, либо добавлять `/api/v1` в единственном общем API client. Страницы и feature clients не должны собирать альтернативные unversioned URLs самостоятельно.

## **5. Контроль качества кода и верификация типов перед Pull Request**

Для минимизации ошибок сборки в CI/CD конвейере перед отправкой изменений в удаленный репозиторий (Pull Request) каждый разработчик обязан выполнить проверку статической типизации TypeScript. Сборка не должна содержать предупреждений и ошибок компиляции:

```powershell
cd backend
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npx.cmd prisma validate
```

PostgreSQL integration tests запускаются только против отдельной test database:

```powershell
$env:RUN_DB_INTEGRATION='true'
npm.cmd test
```

Frontend gate:

```powershell
cd frontend
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## **6. Матрица ответственности и разграничение зон разработки**

Во избежание конфликтов слияния (merge conflicts) и дублирования логики кодовая база и разделы спецификации API распределены между инженерами следующим образом:

| Роль / Разработчик | Модули в backend/src/modules/ | Разделы в API Contract   |
| :---- | :---- | :---- |
| **Backend Developer A** | auth/, cohort/, track/, invitation/, survey/, application/, test-task/ | Auth, Cohorts, Tracks, Invitations, Surveys, Applications, Test Tasks |
| **Backend Developer B** | documents/, tasks/, admin/, platform/shared, route integration | Documents, Reports, Progress, Admin, итоговый API Contract |
| **Frontend Developer** | весь `frontend/**`, включая общий transport и feature API clients | Потребитель frozen contract; frontend acceptance |

## **7. Регламент работы с Git и политика безопасности данных**

Для поддержания высокой скорости поставки фич и чистоты истории коммитов установлены следующие жесткие правила:

* **Исключение конфиденциальных данных:** Категорически запрещено индексировать и отправлять в коммитах файлы из директории backend/uploads/\* (сканы и оригиналы документов студентов).  
* **Изоляция изменений:** Запрещено вносить нерелевантные (unrelated) изменения в конфигурационные файлы верхнего уровня (Docker, глобальные настройки БД, скрипты автоматизации) без явного предварительного апрува от смежного бэкенд-разработчика.  
* **Синхронность документации:** Изменения в коде эндпоинтов бэкенда и файл технической спецификации docs/api-contract.md должны коммититься и пушиться строго в рамках **одного и того же PR**. Код без обновленного контракта к слиянию не допускается.

## **8. Production deployment и эксплуатация**

Production использует отдельный `docker-compose.prod.yml`: multi-stage образы запускают только compiled backend и production Next.js server, PostgreSQL не публикуется наружу, миграции выполняются отдельным one-shot сервисом, а данные БД и uploads сохраняются в named volumes.

```powershell
Copy-Item deploy/.env.production.example deploy/.env.production
# Заменить все placeholder-значения.
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml build --pull
docker compose --env-file deploy/.env.production -f docker-compose.prod.yml up -d
```

Документы для выпуска и эксплуатации:

* [Deployment runbook](docs/runbooks/deployment.md)
* [Backup/restore runbook](docs/runbooks/backup-restore.md)
* [Security operations](docs/runbooks/security-operations.md)
* [Load and resilience testing](docs/runbooks/load-testing.md)
* [B-08 rehearsal evidence](docs/runbooks/b08-rehearsal.md)
* [Production release checklist](docs/release-checklist.md)

Production env-файл, резервные копии и содержимое uploads запрещено коммитить. Перед каждым migration-bearing релизом обязательны off-host backup и restore rehearsal на отдельном окружении.
