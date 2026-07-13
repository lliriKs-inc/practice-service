// services/api/cohorts.ts
//
// ┌───────────────────────────────────────────────────────────────┐
// │ [MOCK] Как убрать моки, когда бэк будет готов:                │
// │  1. grep -rn "\[MOCK\]" services/  — найдёт все места в проекте│
// │  2. Здесь: поставить USE_MOCKS = false                        │
// │  3. Удалить блок "[MOCK-DATA]" ниже и все ветки if (USE_MOCKS) │
// │  4. Заменить localStorage-хранилище на реальные fetch-запросы,│
// │     сигнатуры функций менять не нужно — уже соответствуют API │
// └───────────────────────────────────────────────────────────────┘

import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// [MOCK-CONFIG] Единственный переключатель. false — реальные запросы к API.
export const USE_MOCKS = true

// [MOCK] искусственная задержка для реалистичного UX загрузки
function mockDelay(ms = 350) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Типы (соответствуют новой архитектуре БД) ─────────────────────

export type CohortStatus = 'draft' | 'active' | 'closed'

export interface TestTask {
    title: string
    description: string
    fileUrl: string | null
    publishedAt: string | null
}

export interface Track {
    id: string
    title: string
    testTask: TestTask | null
}

export interface Question {
    id: string
    label: string
    type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox'
    required: boolean
    options: string[]
    order_index: number
}

export interface Survey {
    id: string
    title: string
    questions: Question[]
}

export interface Invitation {
    token: string
    expiresAt: string | null
}

export interface Cohort {
    id: string
    title: string
    status: CohortStatus
    start_date: string
    end_date: string
    created_at: string
    tracks: Track[]
    survey: Survey | null
    invitation: Invitation | null
}

export interface CreateCohortDto {
    title: string
    start_date: string
    end_date: string
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

const MOCK_STORAGE_KEY = 'mock_cohorts' // [MOCK] localStorage key — тоже подчистить

function mockUid() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2, 11)
}

const MOCK_SEED: Cohort[] = [
    {
        id: 'mock-cohort-1',
        title: 'Практика 2026',
        status: 'active',
        start_date: '2026-08-01',
        end_date: '2026-08-31',
        created_at: '2026-07-01T00:00:00.000Z',
        tracks: [
            {
                id: 'mock-track-backend',
                title: 'Backend',
                testTask: {
                    title: 'Разработка REST API',
                    description: 'Реализуй небольшой сервис на Node.js',
                    fileUrl: null,
                    publishedAt: '2026-07-10T00:00:00.000Z',
                },
            },
            { id: 'mock-track-frontend', title: 'Frontend', testTask: null },
        ],
        survey: {
            id: 'mock-survey-1',
            title: 'Анкета 2026',
            questions: [
                { id: 'mock-q-fio', label: 'ФИО', type: 'text', required: true, options: [], order_index: 1 },
                { id: 'mock-q-group', label: 'Группа', type: 'text', required: true, options: [], order_index: 2 },
                { id: 'mock-q-stack', label: 'Стек / инструменты', type: 'textarea', required: true, options: [], order_index: 3 },
            ],
        },
        invitation: { token: 'demo', expiresAt: null },
    },
]

function mockLoadCohorts(): Cohort[] {
    if (typeof window === 'undefined') return MOCK_SEED
    try {
        const raw = localStorage.getItem(MOCK_STORAGE_KEY)
        if (!raw) {
            localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(MOCK_SEED))
            return MOCK_SEED
        }
        return JSON.parse(raw)
    } catch {
        return MOCK_SEED
    }
}

function mockSaveCohorts(cohorts: Cohort[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(cohorts))
}

function mockFindCohort(cohorts: Cohort[], id: string): Cohort {
    const c = cohorts.find(c => c.id === id)
    if (!c) throw new Error('Когорта не найдена')
    return c
}

// [MOCK-ONLY] Сохраняет весь черновик когорты одним махом — используется
// когда UI копит изменения в модалке редактирования и отправляет их только
// по кнопке "Сохранить", а не на каждое поле. У реального бэка единого
// PATCH-эндпоинта на "заменить всю когорту" не будет: при подключении API
// это действие нужно заменить на diff между исходной когортой и черновиком,
// и вызвать точечные ручки (activate/close, createTrack/updateTrackTestTask/
// deleteTrack, createQuestion/updateQuestion/deleteQuestion, createInvitation)
// только для реально изменившихся частей.
export async function saveCohortDraft(id: string, draft: Cohort): Promise<Cohort> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const idx = cohorts.findIndex(c => c.id === id)
        if (idx === -1) throw new Error('Когорта не найдена')
        cohorts[idx] = draft
        mockSaveCohorts(cohorts)
        return draft
    }
    throw new Error('saveCohortDraft недоступен без моков — нужно вызывать точечные API по diff’у')
}

// [MOCK-ONLY] обнулить когорты до дефолтного набора при ручном тестировании
export function resetMockCohorts() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(MOCK_STORAGE_KEY)
}

// [MOCK-ONLY] Синхронное чтение когорт из общего хранилища.
// Нужно, чтобы invitation.ts (публичный /apply/[token]) мог найти
// РЕАЛЬНУЮ когорту, созданную в админке, по её invitation.token —
// вместо того чтобы показывать один и тот же статичный мок всем токенам.
// Удаляется вместе с остальным [MOCK-DATA] блоком.
export function mockPeekCohorts(): Cohort[] {
    return mockLoadCohorts()
}

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] конец блока
// ════════════════════════════════════════════════════════════════

// GET /cohorts
export async function getCohorts(): Promise<Cohort[]> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        return mockLoadCohorts()
    }
    const res = await fetch(`${API_URL}/cohorts`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Не удалось загрузить когорты')
    const data = await res.json()
    if (Array.isArray(data)) return data
    if (data.success && Array.isArray(data.data)) return data.data
    return []
}

// POST /cohorts
export async function createCohort(dto: CreateCohortDto): Promise<Cohort> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohort: Cohort = {
            id: mockUid(),
            title: dto.title,
            status: 'draft',
            start_date: dto.start_date,
            end_date: dto.end_date,
            created_at: new Date().toISOString(),
            tracks: [],
            survey: null,
            invitation: null,
        }
        mockSaveCohorts([cohort, ...mockLoadCohorts()])
        return cohort
    }
    const res = await fetch(`${API_URL}/cohorts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось создать когорту')
    if (data.success && data.data) return data.data
    return data
}

// PATCH /cohorts/:id — общие поля (title, даты)
export async function updateCohort(id: string, dto: Partial<CreateCohortDto>): Promise<Cohort> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, id)
        Object.assign(cohort, dto)
        mockSaveCohorts(cohorts)
        return cohort
    }
    const res = await fetch(`${API_URL}/cohorts/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось обновить когорту')
    if (data.success && data.data) return data.data
    return data
}

// POST /cohorts/:id/activate
export async function activateCohort(id: string): Promise<Cohort> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, id)
        cohort.status = 'active'
        mockSaveCohorts(cohorts)
        return cohort
    }
    const res = await fetch(`${API_URL}/cohorts/${id}/activate`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось активировать когорту')
    if (data.success && data.data) return data.data
    return data
}

// POST /cohorts/:id/close
export async function closeCohort(id: string): Promise<Cohort> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, id)
        cohort.status = 'closed'
        mockSaveCohorts(cohorts)
        return cohort
    }
    const res = await fetch(`${API_URL}/cohorts/${id}/close`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось закрыть когорту')
    if (data.success && data.data) return data.data
    return data
}

// ── Треки ──────────────────────────────────────────────────────

// POST /cohorts/:id/tracks
export async function createTrack(cohortId: string, title: string): Promise<Track> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, cohortId)
        const track: Track = { id: mockUid(), title, testTask: null }
        cohort.tracks.push(track)
        mockSaveCohorts(cohorts)
        return track
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/tracks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось создать трек')
    if (data.success && data.data) return data.data
    return data
}

// DELETE /cohorts/:id/tracks/:trackId
export async function deleteTrack(cohortId: string, trackId: string): Promise<void> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, cohortId)
        cohort.tracks = cohort.tracks.filter(t => t.id !== trackId)
        mockSaveCohorts(cohorts)
        return
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось удалить трек')
}

// PUT /cohorts/:id/tracks/:trackId/test-task
export async function updateTrackTestTask(
    cohortId: string,
    trackId: string,
    patch: Partial<TestTask>
): Promise<TestTask> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, cohortId)
        const track = cohort.tracks.find(t => t.id === trackId)
        if (!track) throw new Error('Трек не найден')
        track.testTask = {
            ...(track.testTask ?? { title: '', description: '', fileUrl: null, publishedAt: null }),
            ...patch,
        }
        mockSaveCohorts(cohorts)
        return track.testTask
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/tracks/${trackId}/test-task`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось обновить тестовое задание')
    if (data.success && data.data) return data.data
    return data
}

// POST /cohorts/:id/tracks/:trackId/test-task/publish
export async function toggleTestTaskPublish(cohortId: string, trackId: string): Promise<TestTask> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, cohortId)
        const track = cohort.tracks.find(t => t.id === trackId)
        if (!track?.testTask) throw new Error('Тестовое задание не найдено')
        track.testTask.publishedAt = track.testTask.publishedAt ? null : new Date().toISOString()
        mockSaveCohorts(cohorts)
        return track.testTask
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/tracks/${trackId}/test-task/publish`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось опубликовать задание')
    if (data.success && data.data) return data.data
    return data
}

// ── Анкета / вопросы ──────────────────────────────────────────

// POST /cohorts/:id/survey/questions
export async function createQuestion(cohortId: string, question: Omit<Question, 'id'>): Promise<Question> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, cohortId)
        if (!cohort.survey) cohort.survey = { id: mockUid(), title: 'Анкета', questions: [] }
        const q: Question = { ...question, id: mockUid() }
        cohort.survey.questions.push(q)
        mockSaveCohorts(cohorts)
        return q
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/survey/questions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(question),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось создать вопрос')
    if (data.success && data.data) return data.data
    return data
}

// PATCH /cohorts/:id/survey/questions/:questionId
export async function updateQuestion(
    cohortId: string,
    questionId: string,
    patch: Partial<Question>
): Promise<Question> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, cohortId)
        const q = cohort.survey?.questions.find(q => q.id === questionId)
        if (!q) throw new Error('Вопрос не найден')
        Object.assign(q, patch)
        mockSaveCohorts(cohorts)
        return q
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/survey/questions/${questionId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось обновить вопрос')
    if (data.success && data.data) return data.data
    return data
}

// DELETE /cohorts/:id/survey/questions/:questionId
export async function deleteQuestion(cohortId: string, questionId: string): Promise<void> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, cohortId)
        if (cohort.survey) {
            cohort.survey.questions = cohort.survey.questions.filter(q => q.id !== questionId)
        }
        mockSaveCohorts(cohorts)
        return
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/survey/questions/${questionId}`, {
        method: 'DELETE',
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось удалить вопрос')
}

// ── Приглашение ────────────────────────────────────────────────

// POST /cohorts/:id/invitation
export async function createInvitation(cohortId: string): Promise<Invitation> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, cohortId)
        cohort.invitation = { token: mockUid().slice(0, 8), expiresAt: null }
        mockSaveCohorts(cohorts)
        return cohort.invitation
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/invitation`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось создать приглашение')
    if (data.success && data.data) return data.data
    return data
}

// POST /cohorts/:id/invitation/regenerate
export async function regenerateInvitation(cohortId: string): Promise<Invitation> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const cohorts = mockLoadCohorts()
        const cohort = mockFindCohort(cohorts, cohortId)
        cohort.invitation = { token: mockUid().slice(0, 8), expiresAt: null }
        mockSaveCohorts(cohorts)
        return cohort.invitation
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/invitation/regenerate`, {
        method: 'POST',
        headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось перегенерировать токен')
    if (data.success && data.data) return data.data
    return data
}
