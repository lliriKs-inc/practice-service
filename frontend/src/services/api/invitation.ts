// services/api/invitation.ts
//
// ┌───────────────────────────────────────────────────────────────┐
// │ [MOCK] Как убрать моки, когда бэк будет готов:                │
// │  1. grep -rn "\[MOCK\]" services/  — найдёт все места в проекте│
// │  2. Здесь: поставить USE_MOCKS = false                        │
// │  3. Удалить блок "[MOCK-DATA]" ниже и все ветки if (USE_MOCKS) │
// │                                                                 │
// │ [MOCK-LINK] Этот файл читает когорты из общего мок-хранилища  │
// │ cohorts.ts (localStorage key mock_cohorts) через mockPeekCohorts│
// │ — так /apply/[token] видит РЕАЛЬНЫЕ треки и вопросы анкеты,   │
// │ настроенные в админке, а не статичный набор.                  │
// │                                                                 │
// │ [MOCK-LINK] Заявки хранят student.id — getMyApplications()    │
// │ показывает только СВОИ заявки, getAllApplications() — отдаёт  │
// │ админке полный список.                                        │
// │                                                                 │
// │ [MOCK-LINK] Заявка теперь хранит даты практики когорты и      │
// │ подписанные ответы анкеты (label+value) прямо на себе — это   │
// │ снимок на момент подачи, не требует повторного джойна.        │
// └───────────────────────────────────────────────────────────────┘

import { getToken, getUser } from './auth'
import { mockPeekCohorts, type TestTask } from './cohorts'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// [MOCK-CONFIG] Единственный переключатель. false — реальные запросы к API.
export const USE_MOCKS = true

// [MOCK] искусственная задержка, чтобы UI (спиннеры/скелетоны) вели себя как с реальной сетью
function mockDelay(ms = 400) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export interface Track {
    id: string
    title: string
}

export interface Question {
    id: string
    label: string
    type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox'
    required: boolean
    options: string[]
    order_index: number
}

export interface InvitationForm {
    cohort: {
        id: string
        title: string
        status: 'draft' | 'active' | 'closed'
    }
    tracks: Track[]
    questions: Question[]
}

export interface ApplicationAnswerDto {
    question_id: string
    answer_value: string
}

export interface ApplicationAnswer {
    label: string
    value: string
}

export interface Application {
    id: string
    status: 'pending' | 'approved' | 'rejected'
    submitted_at: string
    track: { id: string; title: string }
    cohort: {
        id: string
        title: string
        // [MOCK-LINK] нужны, чтобы дневник задач знал границы практики
        // именно ДЛЯ ЭТОЙ конкретной когорты, а не общий заглушечный диапазон
        start_date: string
        end_date: string
    }
    // [MOCK-LINK] кто подал заявку — на реальном бэке выводится из JWT на сервере
    student?: { id: string; email: string }
    // [MOCK-LINK] снимок ответов анкеты на момент подачи — чтобы админ видел,
    // что кандидат написал, без повторного похода к вопросам когорты
    answers?: ApplicationAnswer[]
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

const MOCK_APPS_KEY = 'mock_applications' // [MOCK] localStorage key — тоже подчистить

function mockLoadApplications(): Application[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(MOCK_APPS_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function mockSaveApplications(apps: Application[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_APPS_KEY, JSON.stringify(apps))
}

function mockUid() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2, 11)
}

// [MOCK] находит когорту по токену приглашения среди РЕАЛЬНЫХ когорт,
// созданных в админке — единая точка правды вместо статичного мока
function mockFindCohortByToken(token: string) {
    return mockPeekCohorts().find(c => c.invitation?.token === token)
}

// [MOCK-ONLY] вызывать из консоли браузера чтобы обнулить архив заявок при тестировании
export function resetMockApplications() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(MOCK_APPS_KEY)
}

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] конец блока
// ════════════════════════════════════════════════════════════════

// GET /public/invitations/:token/form — публичный, без авторизации
export async function getInvitationForm(token: string): Promise<InvitationForm> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()

        if (token === 'invalid') throw new Error('Ссылка недействительна')
        if (token === 'expired') throw new Error('Срок действия ссылки истёк')

        const cohort = mockFindCohortByToken(token)
        if (!cohort) throw new Error('Ссылка недействительна')
        if (cohort.status === 'draft') throw new Error('Приём заявок в эту когорту ещё не открыт')
        if (cohort.status === 'closed') throw new Error('Приём заявок в эту когорту закрыт')

        return {
            cohort: { id: cohort.id, title: cohort.title, status: cohort.status },
            tracks: cohort.tracks.map(t => ({ id: t.id, title: t.title })),
            questions: cohort.survey?.questions ?? [],
        }
    }

    const res = await fetch(`${API_URL}/public/invitations/${token}/form`)
    if (res.status === 404) throw new Error('Ссылка недействительна')
    if (res.status === 410) throw new Error('Срок действия ссылки истёк')
    if (!res.ok) throw new Error('Не удалось загрузить анкету')
    const data = await res.json()
    if (data.success && data.data) return data.data
    return data
}

// POST /public/invitations/:token/applications — требует авторизации
export async function submitApplication(
    token: string,
    trackId: string,
    answers: ApplicationAnswerDto[]
): Promise<Application> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay(600)

        const cohort = mockFindCohortByToken(token)
        if (!cohort) throw new Error('Ссылка недействительна')

        const track = cohort.tracks.find(t => t.id === trackId)
        const currentUser = getUser()

        // [MOCK] резолвим label вопроса на момент подачи, чтобы не джойнить повторно
        const resolvedAnswers: ApplicationAnswer[] = answers
            .map(a => {
                const question = cohort.survey?.questions.find(q => q.id === a.question_id)
                return { label: question?.label ?? 'Вопрос', value: a.answer_value }
            })
            .filter(a => a.value.trim() !== '')

        const app: Application = {
            id: mockUid(),
            status: 'pending',
            submitted_at: new Date().toISOString(),
            track: track ? { id: track.id, title: track.title } : { id: trackId, title: 'Неизвестный трек' },
            cohort: {
                id: cohort.id,
                title: cohort.title,
                start_date: cohort.start_date,
                end_date: cohort.end_date,
            },
            student: currentUser ? { id: currentUser.id, email: currentUser.email } : undefined,
            answers: resolvedAnswers,
        }
        mockSaveApplications([app, ...mockLoadApplications()])
        return app
    }

    const res = await fetch(`${API_URL}/public/invitations/${token}/applications`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ track_id: trackId, answers }),
    })
    const data = await res.json()
    if (!res.ok) {
        throw new Error(data.message || data.errors?.[0] || 'Не удалось подать заявку')
    }
    if (data.success && data.data) return data.data
    return data
}

// GET /me/applications — архив заявок ТЕКУЩЕГО студента
export async function getMyApplications(): Promise<Application[]> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const currentUser = getUser()
        return mockLoadApplications().filter(a => a.student?.id === currentUser?.id)
    }

    const res = await fetch(`${API_URL}/me/applications`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Не удалось загрузить заявки')
    const data = await res.json()
    if (Array.isArray(data)) return data
    if (data.success && Array.isArray(data.data)) return data.data
    return []
}

// GET /me/applications/:id — одна заявка
export async function getMyApplication(applicationId: string): Promise<Application> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const app = mockLoadApplications().find(a => a.id === applicationId)
        if (!app) throw new Error('Заявка не найдена')
        return app
    }

    const res = await fetch(`${API_URL}/me/applications/${applicationId}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Заявка не найдена')
    const data = await res.json()
    if (data.success && data.data) return data.data
    return data
}

// GET /me/applications/:id/test-task — тестовое задание выбранного трека этой заявки
export async function getApplicationTestTask(applicationId: string): Promise<TestTask | null> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const app = mockLoadApplications().find(a => a.id === applicationId)
        if (!app) throw new Error('Заявка не найдена')
        const cohort = mockPeekCohorts().find(c => c.id === app.cohort.id)
        const track = cohort?.tracks.find(t => t.id === app.track.id)
        return track?.testTask ?? null
    }

    const res = await fetch(`${API_URL}/me/applications/${applicationId}/test-task`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Не удалось загрузить тестовое задание')
    const data = await res.json()
    if (data.success && data.data) return data.data
    return data
}

// ── Админ: видит заявки ВСЕХ студентов ────────────────────────────

// GET /cohorts/:id/applications (ADMIN) — все заявки, опционально по когорте
export async function getAllApplications(cohortId?: string): Promise<Application[]> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const all = mockLoadApplications()
        return cohortId ? all.filter(a => a.cohort.id === cohortId) : all
    }

    const url = cohortId ? `${API_URL}/cohorts/${cohortId}/applications` : `${API_URL}/applications`
    const res = await fetch(url, { headers: authHeaders() })
    if (!res.ok) throw new Error('Не удалось загрузить заявки')
    const data = await res.json()
    if (Array.isArray(data)) return data
    if (data.success && Array.isArray(data.data)) return data.data
    return []
}

// PATCH /applications/:id/status (ADMIN) — одобрить/отклонить заявку
export async function updateApplicationStatus(
    applicationId: string,
    status: 'approved' | 'rejected'
): Promise<Application> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const apps = mockLoadApplications()
        const idx = apps.findIndex(a => a.id === applicationId)
        if (idx === -1) throw new Error('Заявка не найдена')
        apps[idx] = { ...apps[idx], status }
        mockSaveApplications(apps)
        return apps[idx]
    }

    const res = await fetch(`${API_URL}/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось обновить статус заявки')
    if (data.success && data.data) return data.data
    return data
}
