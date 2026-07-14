// services/api/tasks.ts
//
// ┌───────────────────────────────────────────────────────────────┐
// │ [MOCK] Как убрать моки, когда бэк будет готов:                │
// │  1. grep -rn "\[MOCK\]" services/  — найдёт все места в проекте│
// │  2. Здесь: поставить USE_MOCKS = false                        │
// │  3. Удалить блок "[MOCK-DATA]" ниже и все ветки if (USE_MOCKS) │
// │                                                                 │
// │ Контракт (маршруты, поля, ограничения) списан 1:1 с            │
// │ docs/api-contract.md (раздел "Daily progress") и                │
// │ docs/api/practice.md — календарь DailyTask создаётся бэком      │
// │ целиком в момент одобрения заявки (Пн–Пт в границах практики),  │
// │ фронт только редактирует description/links существующей ячейки, │
// │ создавать/удалять записи нельзя.                                │
// └───────────────────────────────────────────────────────────────┘

import { getToken } from './auth'
import { getMyApplication, getAllApplications } from './invitation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// [MOCK-CONFIG] Единственный переключатель. false — реальные запросы к API.
export const USE_MOCKS = true

function mockDelay(ms = 350) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

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

// ── Админ (F-05): недельный прогресс когорты и пропущенные дни ────

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

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
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

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] — весь этот блок удаляется при отключении моков
// ════════════════════════════════════════════════════════════════

const MOCK_TASKS_KEY = 'mock_daily_tasks'

function mockUid() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2, 11)
}

function mockLoadTasks(): DailyTask[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(MOCK_TASKS_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function mockSaveTasks(tasks: DailyTask[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_TASKS_KEY, JSON.stringify(tasks))
}

// [MOCK-ONLY] обнулить дневник задач при ручном тестировании
export function resetMockDailyTasks() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(MOCK_TASKS_KEY)
}

function mockToUtcDateOnly(iso: string): Date {
    const d = new Date(iso)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function mockIsWeekend(d: Date): boolean {
    const day = d.getUTCDay()
    return day === 0 || day === 6
}

function mockGetMonday(date: Date): Date {
    const d = new Date(date)
    const day = d.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setUTCDate(d.getUTCDate() + diff)
    return d
}

function mockAddDays(date: Date, n: number): Date {
    const d = new Date(date)
    d.setUTCDate(d.getUTCDate() + n)
    return d
}

function mockToISODate(date: Date): string {
    return date.toISOString().split('T')[0]
}

// [MOCK] Реальный backend создаёт весь календарь DailyTask (Пн–Пт в границах
// практики) одной транзакцией в момент одобрения заявки. У моков нет такого
// хука на "одобрение", поэтому досеиваем недостающие будние дни лениво —
// при первом обращении к неделе — но результат для фронта неотличим:
// ячейка либо уже существует (task !== null), либо её ещё не существует
// потому что она вне границ практики.
function mockEnsureCalendar(applicationId: string, practiceStartIso: string, practiceEndIso: string): DailyTask[] {
    const existing = mockLoadTasks()
    const existingDates = new Set(
        existing.filter(t => t.application_id === applicationId).map(t => mockToISODate(new Date(t.task_date)))
    )

    const start = mockToUtcDateOnly(practiceStartIso)
    const end = mockToUtcDateOnly(practiceEndIso)
    const created: DailyTask[] = []

    for (let d = new Date(start); d.getTime() <= end.getTime(); d = mockAddDays(d, 1)) {
        if (mockIsWeekend(d)) continue
        const dateStr = mockToISODate(d)
        if (existingDates.has(dateStr)) continue
        created.push({
            id: mockUid(),
            application_id: applicationId,
            task_date: d.toISOString(),
            description: null,
            saved_at: null,
            links: [],
        })
    }

    if (created.length > 0) {
        mockSaveTasks([...existing, ...created])
        return [...existing, ...created]
    }
    return existing
}

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] конец блока
// ════════════════════════════════════════════════════════════════

// GET /me/applications/:applicationId/tasks?weekStart=...
export async function getMyWeekTasks(applicationId: string, weekStart: string): Promise<StudentWeekResponse> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()

        const application = await getMyApplication(applicationId)
        if (application.status !== 'approved') {
            throw new Error('Дневник задач доступен только для одобренной заявки')
        }

        const allTasks = mockEnsureCalendar(applicationId, application.cohort.start_date, application.cohort.end_date)

        const monday = mockGetMonday(new Date(weekStart))
        const friday = mockAddDays(monday, 4)

        const days: WeekDay[] = Array.from({ length: 5 }, (_, i) => {
            const date = mockAddDays(monday, i)
            const dateStr = mockToISODate(date)
            const task = allTasks.find(
                t => t.application_id === applicationId && mockToISODate(new Date(t.task_date)) === dateStr
            )
            return { date: dateStr, task: task ?? null }
        })

        return {
            applicationId,
            cohort: {
                id: application.cohort.id,
                title: application.cohort.title,
                practice_start: application.cohort.start_date,
                practice_end: application.cohort.end_date,
            },
            track: application.track,
            weekStart: mockToISODate(monday),
            weekEnd: mockToISODate(friday),
            days,
        }
    }

    const res = await fetch(
        `${API_URL}/me/applications/${applicationId}/tasks?weekStart=${weekStart}`,
        { headers: authHeaders() }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить дневник задач')
    return data
}

// PUT /me/daily-tasks/:taskId
export async function updateDailyTask(taskId: string, dto: UpdateDailyTaskDto): Promise<DailyTask> {
    validateDailyTaskUpdate(dto)

    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay(500)

        const tasks = mockLoadTasks()
        const idx = tasks.findIndex(t => t.id === taskId)
        if (idx === -1) throw new Error('Задача не найдена')

        const task = tasks[idx]
        if (mockIsWeekend(mockToUtcDateOnly(task.task_date))) {
            throw new Error('Нельзя редактировать выходной день')
        }

        const updated: DailyTask = {
            ...task,
            description: dto.description,
            saved_at: new Date().toISOString(),
            links: dto.links.map(l => ({ id: mockUid(), daily_task_id: taskId, url: l.url.trim() })),
        }
        tasks[idx] = updated
        mockSaveTasks(tasks)
        return updated
    }

    const res = await fetch(`${API_URL}/me/daily-tasks/${taskId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось сохранить задачу')
    return data
}

// [MOCK-ONLY] число пропущенных дней по заявке за весь период практики —
// нужно для карточки заявки в админке (аналог `dailyTasks` count на бэке)
export async function getMissedDaysCount(applicationId: string): Promise<number> {
    if (USE_MOCKS) {
        await mockDelay(100)
        const application = await getMyApplication(applicationId)
        if (application.status !== 'approved') return 0
        const allTasks = mockEnsureCalendar(applicationId, application.cohort.start_date, application.cohort.end_date)
        const today = mockToUtcDateOnly(new Date().toISOString())
        return allTasks.filter(
            t => t.application_id === applicationId
                && t.description === null
                && mockToUtcDateOnly(t.task_date).getTime() <= today.getTime()
        ).length
    }
    return 0
}

// GET /cohorts/:cohortId/progress?weekStart=... (ADMIN)
export async function getCohortWeekProgress(cohortId: string, weekStart: string): Promise<CohortWeekProgress> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()

        const applications = (await getAllApplications(cohortId)).filter(a => a.status === 'approved')
        const weeks = await Promise.all(applications.map(app => getMyWeekTasks(app.id, weekStart)))

        const first = weeks[0]
        const monday = mockGetMonday(new Date(weekStart))
        const friday = mockAddDays(monday, 4)

        return {
            cohort: first
                ? { id: first.cohort.id, title: first.cohort.title, practiceStart: first.cohort.practice_start, practiceEnd: first.cohort.practice_end }
                : { id: cohortId, title: '', practiceStart: mockToISODate(monday), practiceEnd: mockToISODate(friday) },
            weekStart: mockToISODate(monday),
            weekEnd: mockToISODate(friday),
            days: Array.from({ length: 5 }, (_, i) => mockToISODate(mockAddDays(monday, i))),
            students: applications.map((app, i) => ({
                applicationId: app.id,
                student: { id: app.student?.id ?? '', email: app.student?.email ?? '' },
                track: app.track,
                tasks: weeks[i].days,
            })),
        }
    }

    const res = await fetch(`${API_URL}/cohorts/${cohortId}/progress?weekStart=${weekStart}`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить прогресс когорты')
    return data
}

// GET /cohorts/:cohortId/progress/missed?weekStart=&studentId= (ADMIN)
export async function getMissedProgress(cohortId: string, weekStart: string, studentId?: string): Promise<MissedProgress> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()

        const progress = await getCohortWeekProgress(cohortId, weekStart)
        const today = mockToUtcDateOnly(new Date().toISOString())

        const missed: MissedTaskEntry[] = progress.students
            .filter(s => !studentId || s.student.id === studentId)
            .flatMap(s =>
                s.tasks
                    .filter(day => day.task && day.task.description === null && mockToUtcDateOnly(day.date).getTime() <= today.getTime())
                    .map(day => ({
                        applicationId: s.applicationId,
                        taskId: day.task!.id,
                        taskDate: day.date,
                        student: s.student,
                        track: s.track,
                        links: day.task!.links,
                    }))
            )

        return { cohortId, weekStart: progress.weekStart, weekEnd: progress.weekEnd, missed }
    }

    const params = new URLSearchParams({ weekStart, ...(studentId ? { studentId } : {}) })
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/progress/missed?${params}`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить пропущенные дни')
    return data
}
