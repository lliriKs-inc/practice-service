# ADR 001: Стратегия перехода на новую архитектуру БД и статусная политика контура Admissions

## Статус
Предложено (В рамках задачи A-00)

## Контекст
Текущая база данных и бэкенд находятся в рассинхронизации: схема `schema.prisma` обновлена под цепочку `User -> Application -> Track -> Cohort`, но код сервисов ожидает старые сущности (`CohortRole`, `SurveyField`). Проект находится на этапе MVP, обратная совместимость данных не требуется.

## Решения

### 1. Стратегия миграции (Migration Strategy)
Вместо написания сложных миграционных скриптов трансформации данных принимается стратегия **Controlled Reset** (контролируемый сброс локальной БД). При развёртывании новой схемы выполняется полная очистка таблиц с последующим накатом идемпотентного сида (`seed.ts`), который сформирует демонстрационную структуру пользователей, когорт, треков и анкет под новую модель. Деструктивные команды на удалённых серверах без аппрува лида запрещены.

### 2. Политика обработки причин отказа (Rejection Reason Policy)
Для реализации бизнес-требования возможности переподачи заявок в статусах `PENDING` и `REJECTED`, а также информирования студента о причинах отказа:
* В модель `APPLICATION` добавляется опциональное поле `rejection_reason TEXT NULL`.
* Данное поле заполняется администратором при переводе заявки в статус `rejected`.
* При повторной подаче заявки или её переводе обратно в `pending` поле зануляется.

### 3. Политика контекстов и статусов
* Правом перевода заявки в статус `approved` обладает только системный `ADMIN`.
* В момент перевода заявки в статус `approved` бэкенд обязан триггерить создание пустых дневных записей прогресса `DAILY_TASK` на весь период практики (исключая сб/вс) на основе дат `Cohort.start_date` и `Cohort.end_date`.
* Жизненный цикл когорты ограничен последовательностью `DRAFT → ACTIVE → CLOSED`. Обратные переходы, повторное открытие закрытой когорты и статус `PAUSED` не входят в MVP.
* Временная остановка приёма заявок выполняется отзывом или регенерацией `Invitation.token`, а не изменением статуса когорты. `CLOSED` — окончательное бизнес-состояние.
## Decision acceptance

**Status:** Accepted
**Owner:** Backend Developer A
**Date:** 2026-07-13
**Review:** Tech Lead review is recorded by the PR/commit that accepts this ADR.

The decisions in this ADR are the approved MVP basis for the admissions cutover. Backward compatibility with the legacy admissions model is not required. Legacy code remains only until A-08 and must not be extended.

## Tech Lead review

- Reviewer: ФИО второго разработчика
- Date: 2026-07-13
- Decision: Approved
- Scope: migration strategy, rejection reason, context/status policy, admissions API
