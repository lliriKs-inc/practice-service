import { type Page, expect } from '@playwright/test'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
const ADMIN_EMAIL = 'admin@academy.com'
const ADMIN_PASSWORD = 'password123'

interface ApiEnvelope<T> {
    success: boolean
    data: T
}

async function apiRequest<T = unknown>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    })
    const text = await res.text()
    const parsed = text ? JSON.parse(text) : null
    if (!res.ok) {
        throw new Error(`API ${options.method ?? 'GET'} ${path} failed: ${res.status} ${text}`)
    }
    if (parsed && typeof parsed === 'object' && 'success' in parsed && 'data' in parsed) {
        return (parsed as ApiEnvelope<T>).data
    }
    return parsed as T
}

async function adminLogin(): Promise<string> {
    const { token } = await apiRequest<{ token: string }>('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    })
    return token
}

export interface SeededInvitation {
    cohortId: string
    token: string
    backendTrackId: string
    frontendTrackId: string
}

// Заводит реальную когорту + 2 трека + анкету (3 текстовых вопроса) +
// тестовое задание на трек Backend + инвайт-токен — через прямые вызовы
// admin-API (после того как backend доделал Cohort/Track/Survey/Invitation
// API, мок-домен /apply/demo больше не существует, см.
// infa/HANDOFF_2026-07-15_REAL_API_CUTOVER.md).
export async function seedInvitedCohort(): Promise<SeededInvitation> {
    const adminToken = await adminLogin()

    const now = new Date()
    const applicationStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
    const applicationEnd = new Date(now.getTime() + 5 * 60 * 1000)
    const practiceStart = applicationEnd
    const practiceEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

    const cohort = await apiRequest<{ id: string }>('/cohorts', adminToken, {
        method: 'POST',
        body: JSON.stringify({
            title: `E2E ${Date.now()}`,
            application_start: applicationStart.toISOString(),
            application_end: applicationEnd.toISOString(),
            practice_start: practiceStart.toISOString(),
            practice_end: practiceEnd.toISOString(),
        }),
    })
    // Не активируем — только одна когорта может быть ACTIVE одновременно, а
    // проверка окна приёма заявок (getPublicFormByInvitationToken) блокирует
    // только CLOSED, поэтому DRAFT подходит для E2E без конфликта с уже
    // существующей активной когортой в базе.
    const backendTrack = await apiRequest<{ id: string }>(`/cohorts/${cohort.id}/tracks`, adminToken, {
        method: 'POST',
        body: JSON.stringify({ title: 'Backend' }),
    })
    const frontendTrack = await apiRequest<{ id: string }>(`/cohorts/${cohort.id}/tracks`, adminToken, {
        method: 'POST',
        body: JSON.stringify({ title: 'Frontend' }),
    })

    await apiRequest(`/cohorts/${cohort.id}/tracks/${backendTrack.id}/test-task`, adminToken, {
        method: 'PUT',
        body: JSON.stringify({ title: 'Разработка REST API', description: 'Описание задания' }),
    })
    await apiRequest(`/cohorts/${cohort.id}/tracks/${backendTrack.id}/test-task/publish`, adminToken, { method: 'POST' })

    await apiRequest(`/cohorts/${cohort.id}/survey`, adminToken, {
        method: 'POST',
        body: JSON.stringify({ title: 'Анкета' }),
    })
    for (const [label, order] of [['ФИО', 1], ['Группа', 2], ['Стек / инструменты', 3]] as const) {
        await apiRequest(`/cohorts/${cohort.id}/survey/questions`, adminToken, {
            method: 'POST',
            body: JSON.stringify({ label, type: 'TEXT', required: true, order_index: order }),
        })
    }

    const invitation = await apiRequest<{ token: string }>(`/cohorts/${cohort.id}/invitation`, adminToken, {
        method: 'POST',
        body: JSON.stringify({ expires_in_days: 7 }),
    })

    return { cohortId: cohort.id, token: invitation.token, backendTrackId: backendTrack.id, frontendTrackId: frontendTrack.id }
}

export function uniqueEmail(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.local`
}

export interface CandidateCreds {
    fullName: string
    email: string
    password: string
}

export async function registerViaUI(page: Page, creds: CandidateCreds) {
    await page.getByLabel('ФИО').fill(creds.fullName)
    await page.getByLabel('E-mail').fill(creds.email)
    await page.getByLabel('Пароль', { exact: true }).fill(creds.password)
    await page.getByLabel('Повторите пароль').fill(creds.password)
    await page.getByRole('button', { name: /Зарегистрироваться/ }).click()
}

export async function loginViaUI(page: Page, email: string, password: string) {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Пароль').fill(password)
    await page.getByRole('button', { name: /Войти/ }).click()
}

export async function logoutViaUI(page: Page) {
    await page.evaluate(() => {
        localStorage.removeItem('jwt')
        localStorage.removeItem('user')
    })
}

// Вопросы анкеты рендерятся без htmlFor/id-связки label↔input (визуальные
// labels), поэтому ищем поле как соседа найденного текста лейбла.
export async function fillSurveyQuestion(page: Page, labelText: string, value: string) {
    const label = page.getByText(labelText, { exact: false }).first()
    const container = label.locator('..')
    const field = container.locator('input, textarea').first()
    await field.fill(value)
}

export async function expectNoSeriousA11yViolations(page: Page) {
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}
