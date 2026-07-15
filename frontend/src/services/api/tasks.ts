// services/api/tasks.ts
//
// Реальный API — контракт списан 1:1 с docs/api-contract.md ("Daily
// progress") и docs/api/practice.md, проверен вручную. Календарь DailyTask
// создаётся сервером целиком в момент одобрения заявки (Пн–Пт в границах
// практики) — фронт только редактирует description/links существующей
// ячейки, создавать/удалять записи нельзя.

import { apiFetch } from '@/lib/api/http'

// Совпадает с docs/api-contract.md, раздел "Daily progress"
export const MAX_DESCRIPTION_LENGTH = 10000
export const MAX_LINKS_COUNT = 50

export interface DailyTaskLink {
    id: string
    daily_task_id: string
    url: string
}

export interface DailyTask {
    id: string
    application_id: string
    task_date: string
    description: string | null
    saved_at: string | null
    links: DailyTaskLink[]
}

export interface WeekDay {
    date: string
    task: DailyTask | null
}

export interface StudentWeekResponse {
    applicationId: string
    cohort: { id: string; title: string; practice_start: string; practice_end: string }
    track: { id: string; title: string }
    weekStart: string
    weekEnd: string
    days: WeekDay[]
}

export interface UpdateDailyTaskDto {
    description: string | null
    links: { url: string }[]
}

// ── Админ: недельный прогресс когорты и пропущенные дни ────

export interface CohortWeekProgress {
    cohort: { id: string; title: string; practiceStart: string; practiceEnd: string }
    weekStart: string
    weekEnd: string
    days: string[]
    students: {
        applicationId: string
        student: { id: string; email: string }
        track: { id: string; title: string }
        tasks: WeekDay[]
    }[]
}

export interface MissedTaskEntry {
    applicationId: string
    taskId: string
    taskDate: string
    student: { id: string; email: string }
    track: { id: string; title: string }
    links: DailyTaskLink[]
}

export interface MissedProgress {
    cohortId: string
    weekStart: string
    weekEnd: string
    missed: MissedTaskEntry[]
}

export class DailyTaskValidationError extends Error {}

// Проверка на клиенте до отправки — та же логика, что и на бэке
export function validateDailyTaskUpdate(dto: UpdateDailyTaskDto): void {
    if (dto.description !== null && dto.description.length > MAX_DESCRIPTION_LENGTH) {
        throw new DailyTaskValidationError(`Описание не может быть длиннее ${MAX_DESCRIPTION_LENGTH} символов`)
    }
    if (dto.links.length > MAX_LINKS_COUNT) {
        throw new DailyTaskValidationError(`Можно добавить не более ${MAX_LINKS_COUNT} ссылок`)
    }
    const urls = dto.links.map(l => l.url.trim())
    if (urls.some(u => u === '')) {
        throw new DailyTaskValidationError('Ссылка не может быть пустой')
    }
    if (new Set(urls).size !== urls.length) {
        throw new DailyTaskValidationError('Ссылки не должны повторяться')
    }
}

function mapDailyTask(raw: any): DailyTask {
    return {
        id: raw.id,
        application_id: raw.application_id,
        task_date: raw.task_date,
        description: raw.description,
        saved_at: raw.saved_at,
        links: (raw.links ?? []).map((l: any) => ({ id: l.id, daily_task_id: l.daily_task_id, url: l.url })),
    }
}

// GET /me/applications/:applicationId/tasks?weekStart=...
export async function getMyWeekTasks(applicationId: string, weekStart: string): Promise<StudentWeekResponse> {
    const data = await apiFetch<any>(`/me/applications/${applicationId}/tasks?weekStart=${weekStart}`)
    return {
        applicationId: data.applicationId,
        cohort: {
            id: data.cohort.id,
            title: data.cohort.title,
            practice_start: data.cohort.practice_start,
            practice_end: data.cohort.practice_end,
        },
        track: data.track,
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        days: data.days.map((d: any) => ({ date: d.date, task: d.task ? mapDailyTask(d.task) : null })),
    }
}

// PUT /me/daily-tasks/:taskId
export async function updateDailyTask(taskId: string, dto: UpdateDailyTaskDto): Promise<DailyTask> {
    validateDailyTaskUpdate(dto)
    return mapDailyTask(await apiFetch<any>(`/me/daily-tasks/${taskId}`, { method: 'PUT', body: dto }))
}

// GET /cohorts/:cohortId/progress?weekStart=... (ADMIN)
export async function getCohortWeekProgress(cohortId: string, weekStart: string): Promise<CohortWeekProgress> {
    const data = await apiFetch<any>(`/cohorts/${cohortId}/progress?weekStart=${weekStart}`)
    return {
        cohort: { id: data.cohort.id, title: data.cohort.title, practiceStart: data.cohort.practiceStart, practiceEnd: data.cohort.practiceEnd },
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        days: data.days,
        students: data.students.map((s: any) => ({
            applicationId: s.applicationId,
            student: { id: s.student.id, email: s.student.email },
            track: s.track,
            tasks: s.tasks.map((d: any) => ({ date: d.date, task: d.task ? mapDailyTask(d.task) : null })),
        })),
    }
}

// GET /cohorts/:cohortId/progress/missed?weekStart=&studentId= (ADMIN)
export async function getMissedProgress(cohortId: string, weekStart: string, studentId?: string): Promise<MissedProgress> {
    const params = new URLSearchParams({ weekStart, ...(studentId ? { studentId } : {}) })
    const data = await apiFetch<any>(`/cohorts/${cohortId}/progress/missed?${params}`)
    return {
        cohortId: data.cohortId,
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        missed: data.missed.map((m: any) => ({
            applicationId: m.applicationId,
            taskId: m.taskId,
            taskDate: m.taskDate,
            student: { id: m.student.id, email: m.student.email },
            track: m.track,
            links: m.links,
        })),
    }
}

// [ОГРАНИЧЕНИЕ] Реальный API не отдаёт агрегат "пропущено дней за весь срок
// практики" — только per-week (progress/missed). Показываем пропуски за
// ТЕКУЩУЮ неделю вместо общего счётчика за весь период практики; см.
// заметку в прогресс-файле про возможный новый эндпоинт агрегата у backend.
export async function getMissedDaysThisWeek(cohortId: string, studentId: string, weekStart: string): Promise<number> {
    const progress = await getMissedProgress(cohortId, weekStart, studentId)
    return progress.missed.length
}
