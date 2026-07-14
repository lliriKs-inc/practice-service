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
import { apiFetch } from '@/lib/api/http'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

// [MOCK-CONFIG] Единственный переключатель. false — реальные запросы к API.
export const USE_MOCKS = false

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
    application_start?: string | null
    application_end?: string | null
    created_at: string
    tracks: Track[]
    survey: Survey | null
    invitation: Invitation | null
}

export interface CreateCohortDto {
    title: string
    start_date: string
    end_date: string
    application_start?: string
    application_end?: string
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    return apiFetch<T>(path, { ...init, body: init.body ? JSON.parse(String(init.body)) : undefined })
}

function mapType(type: string): Question['type'] {
    return type.toLowerCase() as Question['type']
}

function mapQuestion(question: any): Question {
    return { ...question, type: mapType(question.type), options: Array.isArray(question.options) ? question.options : [], order_index: question.order_index ?? 0 }
}

function mapTestTask(task: any): TestTask | null {
    if (!task) return null
    return { title: task.title, description: task.description ?? '', fileUrl: task.file_url ?? null, publishedAt: task.published_at ?? null }
}

function mapCohort(raw: any): Cohort {
    return {
        id: raw.id,
        title: raw.title,
        status: String(raw.status).toLowerCase() as CohortStatus,
        start_date: raw.practice_start ?? raw.start_date,
        end_date: raw.practice_end ?? raw.end_date,
        application_start: raw.application_start ?? null,
        application_end: raw.application_end ?? null,
        created_at: raw.created_at,
        tracks: (raw.tracks ?? []).map((track: any) => ({ id: track.id, title: track.title, testTask: mapTestTask(track.testTask) })),
        survey: raw.survey ? { id: raw.survey.id, title: raw.survey.title, questions: (raw.survey.questions ?? []).map(mapQuestion) } : null,
        invitation: raw.invitation ? { token: raw.invitation.token, expiresAt: raw.invitation.expires_at ?? null } : null,
    }
}

function questionPayload(question: Partial<Question>) {
    return {
        ...question,
        ...(question.type ? { type: question.type.toUpperCase() } : {}),
        ...(question.options ? { options: question.options.length ? question.options : null } : {}),
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
    const current = await getCohort(id)
    if (draft.title !== current.title || draft.start_date !== current.start_date || draft.end_date !== current.end_date || draft.application_start !== current.application_start || draft.application_end !== current.application_end) {
        await updateCohort(id, { title: draft.title, start_date: draft.start_date, end_date: draft.end_date, application_start: draft.application_start ?? undefined, application_end: draft.application_end ?? undefined })
    }
    if (draft.status !== current.status) {
        if (draft.status === 'active') await activateCohort(id)
        else if (draft.status === 'closed') await closeCohort(id)
        else throw new Error('Нельзя повторно открыть закрытую когорту')
    }
    const currentTracks = new Map(current.tracks.map(track => [track.id, track]))
    for (const track of draft.tracks) {
        let previous = currentTracks.get(track.id)
        if (!previous) {
            const created = await createTrack(id, track.title)
            previous = created
            currentTracks.set(created.id, created)
        }
        if (previous.title !== track.title) await updateTrack(id, previous.id, track.title)
        if (JSON.stringify(previous.testTask) !== JSON.stringify(track.testTask) && track.testTask) {
            await updateTrackTestTask(id, previous.id, { title: track.testTask.title, description: track.testTask.description })
        }
        if (!!previous.testTask?.publishedAt !== !!track.testTask?.publishedAt && track.testTask) await toggleTestTaskPublish(id, previous.id)
    }
    for (const track of current.tracks) if (!draft.tracks.some(next => next.id === track.id)) await deleteTrack(id, track.id)

    const currentSurvey = current.survey
    let surveyId = currentSurvey?.id
    if (draft.survey && !surveyId) surveyId = (await createSurvey(id, draft.survey.title)).id
    if (draft.survey && surveyId) {
        const currentQuestions = new Map((currentSurvey?.questions ?? []).map(question => [question.id, question]))
        for (const question of draft.survey.questions) {
            const previous = currentQuestions.get(question.id)
            if (!previous) await createQuestion(id, question)
            else if (JSON.stringify(previous) !== JSON.stringify(question)) await updateQuestion(id, question.id, question)
        }
        for (const question of currentSurvey?.questions ?? []) if (!draft.survey.questions.some(next => next.id === question.id)) await deleteQuestion(id, question.id)
    }
    if (!draft.invitation && current.invitation) await deleteInvitation(id)
    else if (draft.invitation && !current.invitation) await createInvitation(id)
    else if (draft.invitation && current.invitation && draft.invitation.token !== current.invitation.token) await regenerateInvitation(id)
    return getCohort(id)
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
    const data = await apiRequest<any[]>('/cohorts')
    return data.map(mapCohort)
}

export async function getCohort(id: string): Promise<Cohort> {
    return mapCohort(await apiRequest<any>(`/cohorts/${id}`))
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
    return mapCohort(await apiRequest<any>('/cohorts', { method: 'POST', body: JSON.stringify({ title: dto.title, practice_start: dto.start_date, practice_end: dto.end_date, application_start: dto.application_start, application_end: dto.application_end }) }))
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
    return mapCohort(await apiRequest<any>(`/cohorts/${id}`, { method: 'PATCH', body: JSON.stringify({ title: dto.title, practice_start: dto.start_date, practice_end: dto.end_date, application_start: dto.application_start, application_end: dto.application_end }) }))
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
    return mapCohort(await apiRequest<any>(`/cohorts/${id}/activate`, { method: 'PATCH' }))
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
    return mapCohort(await apiRequest<any>(`/cohorts/${id}/close`, { method: 'PATCH' }))
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
    const data = await apiRequest<any>(`/cohorts/${cohortId}/tracks`, { method: 'POST', body: JSON.stringify({ title }) })
    return { id: data.id, title: data.title, testTask: mapTestTask(data.testTask) }
}

export async function updateTrack(cohortId: string, trackId: string, title: string): Promise<Track> {
    const data = await apiRequest<any>(`/cohorts/${cohortId}/tracks/${trackId}`, { method: 'PATCH', body: JSON.stringify({ title }) })
    return { id: data.id, title: data.title, testTask: mapTestTask(data.testTask) }
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
    await apiRequest<void>(`/cohorts/${cohortId}/tracks/${trackId}`, { method: 'DELETE' })
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
    return mapTestTask(await apiRequest<any>(`/cohorts/${cohortId}/tracks/${trackId}/test-task`, { method: 'PUT', body: JSON.stringify(patch) }))!
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
    return mapTestTask(await apiRequest<any>(`/cohorts/${cohortId}/tracks/${trackId}/test-task/publish`, { method: 'POST' }))!
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
    return mapQuestion(await apiRequest<any>(`/cohorts/${cohortId}/survey/questions`, { method: 'POST', body: JSON.stringify(questionPayload(question)) }))
}

async function createSurvey(cohortId: string, title: string): Promise<Survey> {
    const data = await apiRequest<any>(`/cohorts/${cohortId}/survey`, { method: 'POST', body: JSON.stringify({ title }) })
    return { id: data.id, title: data.title, questions: (data.questions ?? []).map(mapQuestion) }
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
    return mapQuestion(await apiRequest<any>(`/cohorts/${cohortId}/survey/questions/${questionId}`, { method: 'PATCH', body: JSON.stringify(questionPayload(patch)) }))
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
    await apiRequest<void>(`/cohorts/${cohortId}/survey/questions/${questionId}`, { method: 'DELETE' })
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
    const data = await apiRequest<any>(`/cohorts/${cohortId}/invitation`, { method: 'POST' })
    return { token: data.token, expiresAt: data.expires_at ?? null }
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
    const data = await apiRequest<any>(`/cohorts/${cohortId}/invitation/regenerate`, { method: 'POST' })
    return { token: data.token, expiresAt: data.expires_at ?? null }
}

export async function deleteInvitation(cohortId: string): Promise<void> {
    await apiRequest<void>(`/cohorts/${cohortId}/invitation`, { method: 'DELETE' })
}
