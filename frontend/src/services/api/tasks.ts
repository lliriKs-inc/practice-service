// services/api/tasks.ts
//
// ┌───────────────────────────────────────────────────────────────┐
// │ [MOCK] Как убрать моки, когда бэк будет готов:                │
// │  1. grep -rn "\[MOCK\]" services/  — найдёт все места в проекте│
// │  2. Здесь: поставить USE_MOCKS = false                        │
// │  3. Удалить блок "[MOCK-DATA]" ниже и все ветки if (USE_MOCKS) │
// └───────────────────────────────────────────────────────────────┘

import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// [MOCK-CONFIG] Единственный переключатель. false — реальные запросы к API.
export const USE_MOCKS = true

// [MOCK] искусственная задержка для реалистичного UX загрузки
function mockDelay(ms = 350) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export interface Task {
    id: string
    user_id: string
    cohort_id: string
    date: string
    title: string
    description: string
    artifact_link: string | null
    updated_at: string
}

export interface CreateTaskDto {
    date: string
    title: string
    description: string
    artifact_link?: string | null
}

export interface WeekTasksResponse {
    weekStart: string
    weekEnd: string
    practiceStart: string
    practiceEnd: string
    tasks: Task[]
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
}

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] — весь этот блок удаляется при отключении моков
// ════════════════════════════════════════════════════════════════

const MOCK_STORAGE_KEY = 'mock_tasks' // [MOCK] localStorage key — тоже подчистить

// [MOCK] период практики для расчёта границ недель на дашборде
const MOCK_PRACTICE_START = '2026-08-01T00:00:00.000Z'
const MOCK_PRACTICE_END = '2026-08-31T00:00:00.000Z'
const MOCK_COHORT_ID = 'mock-cohort-1'
const MOCK_USER_ID = 'mock-user-1'

function mockUid() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2, 11)
}

function mockLoadTasks(): Task[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(MOCK_STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function mockSaveTasks(tasks: Task[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(tasks))
}

function mockGetMonday(date: Date): Date {
    const d = new Date(date)
    d.setUTCHours(0, 0, 0, 0)
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

// [MOCK-ONLY] обнулить список задач при ручном тестировании
export function resetMockTasks() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(MOCK_STORAGE_KEY)
}

// [MOCK-ONLY] засеять неделю парой готовых задач — удобно чтобы сразу видеть заполненные ячейки
export function seedMockTasks() {
    if (typeof window === 'undefined') return
    const monday = mockGetMonday(new Date())
    const seeded: Task[] = [
        {
            id: mockUid(),
            user_id: MOCK_USER_ID,
            cohort_id: MOCK_COHORT_ID,
            date: mockAddDays(monday, 0).toISOString(),
            title: 'Настройка окружения',
            description: 'Поднял Docker, разобрался со структурой проекта',
            artifact_link: 'https://github.com/example/setup',
            updated_at: new Date().toISOString(),
        },
        {
            id: mockUid(),
            user_id: MOCK_USER_ID,
            cohort_id: MOCK_COHORT_ID,
            date: mockAddDays(monday, 2).toISOString(),
            title: 'Верстка дашборда',
            description: 'Собрал вкладки Заявки/Документы/Задачи',
            artifact_link: null,
            updated_at: new Date().toISOString(),
        },
    ]
    mockSaveTasks(seeded)
}

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] конец блока
// ════════════════════════════════════════════════════════════════

// POST /tasks
export async function createTask(dto: CreateTaskDto): Promise<Task> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const task: Task = {
            id: mockUid(),
            user_id: MOCK_USER_ID,
            cohort_id: MOCK_COHORT_ID,
            date: dto.date,
            title: dto.title,
            description: dto.description,
            artifact_link: dto.artifact_link ?? null,
            updated_at: new Date().toISOString(),
        }
        mockSaveTasks([...mockLoadTasks(), task])
        return task
    }

    const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось создать задачу')
    }
    return res.json()
}

// GET /tasks
export async function getTasks(): Promise<Task[]> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        return mockLoadTasks()
    }

    const res = await fetch(`${API_URL}/tasks`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Не удалось загрузить задачи')
    return res.json()
}

// GET /tasks/week?weekStart=...
// [FIX] Раньше границы практики всегда брались из статичной заглушки
// MOCK_PRACTICE_START/END, никак не связанной с реальной когортой заявки.
// Теперь можно передать реальные даты (из Application.cohort одобренной
// заявки) — если не передали, используется заглушка как раньше.
export async function getWeekTasks(
    weekStart: string,
    practiceBounds?: { practiceStart: string; practiceEnd: string }
): Promise<WeekTasksResponse> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const monday = mockGetMonday(new Date(weekStart))
        const friday = mockAddDays(monday, 4)
        const allTasks = mockLoadTasks()
        const weekTasks = allTasks.filter(t => {
            const d = new Date(t.date).getTime()
            return d >= monday.getTime() && d <= friday.getTime()
        })
        return {
            weekStart: monday.toISOString(),
            weekEnd: friday.toISOString(),
            practiceStart: practiceBounds?.practiceStart ?? MOCK_PRACTICE_START,
            practiceEnd: practiceBounds?.practiceEnd ?? MOCK_PRACTICE_END,
            tasks: weekTasks,
        }
    }

    const res = await fetch(`${API_URL}/tasks/week?weekStart=${weekStart}`, { headers: authHeaders() })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось загрузить задачи недели')
    }
    return res.json()
}

// PATCH /tasks/:id
export async function updateTask(id: string, dto: Partial<CreateTaskDto>): Promise<Task> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const tasks = mockLoadTasks()
        const idx = tasks.findIndex(t => t.id === id)
        if (idx === -1) throw new Error('Задача не найдена')
        tasks[idx] = { ...tasks[idx], ...dto, updated_at: new Date().toISOString() }
        mockSaveTasks(tasks)
        return tasks[idx]
    }

    const res = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось обновить задачу')
    }
    return res.json()
}

// DELETE /tasks/:id
export async function deleteTask(id: string): Promise<void> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        mockSaveTasks(mockLoadTasks().filter(t => t.id !== id))
        return
    }

    const res = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось удалить задачу')
    }
}

// GET /tasks/all (ADMIN)
export async function getAllTasks(): Promise<Task[]> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        return mockLoadTasks()
    }

    const res = await fetch(`${API_URL}/tasks/all`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Не удалось загрузить все задачи')
    return res.json()
}

// GET /tasks/all/week?weekStart=... (ADMIN)
export async function getAllWeekTasks(weekStart: string): Promise<WeekTasksResponse> {
    if (USE_MOCKS) {
        // [MOCK]
        return getWeekTasks(weekStart)
    }

    const res = await fetch(`${API_URL}/tasks/all/week?weekStart=${weekStart}`, { headers: authHeaders() })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось загрузить задачи недели')
    }
    return res.json()
}
