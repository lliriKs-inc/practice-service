// services/api/invitation.ts
//
// Реальный API (см. docs/api/admissions.md, docs/api-contract.md). Контракт
// подтверждён вручную (curl/E2E) против backend после мержа cohort-api-complete.

import { getUser } from './auth'
import { apiFetch } from '@/lib/api/http'

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
    rejection_reason?: string | null
    track: { id: string; title: string }
    cohort: {
        id: string
        title: string
        // Совпадает с реальным полем практики (practice_start/practice_end) —
        // нужны дневнику задач, чтобы знать границы практики этой когорты.
        start_date: string
        end_date: string
    }
    // Есть только в админских ответах (listForCohort/getForCohort) — сервер
    // подставляет из JWT/route, в собственном /me/applications его нет.
    student?: { id: string; email: string }
    answers?: ApplicationAnswer[]
}

function mapQuestionType(type: string): Question['type'] {
    return type.toLowerCase() as Question['type']
}

function mapQuestion(raw: any): Question {
    return {
        id: raw.id,
        label: raw.label,
        type: mapQuestionType(raw.type),
        required: raw.required,
        options: Array.isArray(raw.options) ? raw.options : [],
        order_index: raw.order_index ?? 0,
    }
}

function mapApplication(raw: any): Application {
    return {
        id: raw.id,
        status: String(raw.status).toLowerCase() as Application['status'],
        submitted_at: raw.submitted_at,
        rejection_reason: raw.rejection_reason ?? null,
        track: { id: raw.track.id, title: raw.track.title },
        cohort: {
            id: raw.track.cohort.id,
            title: raw.track.cohort.title,
            start_date: raw.track.cohort.practice_start,
            end_date: raw.track.cohort.practice_end,
        },
        student: raw.user ? { id: raw.user.id, email: raw.user.email } : undefined,
        answers: Array.isArray(raw.answers)
            ? raw.answers.map((a: any) => ({ label: a.question?.label ?? 'Вопрос', value: a.answer_value }))
            : undefined,
    }
}

// У студента может быть только одна "активная" заявка одновременно —
// на рассмотрении или уже одобренная. Пока она не отклонена, подать новую
// анкету нельзя (иначе непонятно, какая заявка ведёт дневник задач).
// Отклонённые заявки в счёт не идут — по ним можно попробовать снова.
//
// Реальный backend разрешает несколько заявок от одного пользователя (по
// одной на трек — уникальность (user_id, track_id)), поэтому это правило
// сейчас проверяется только на фронте; см. вопрос backend-команде в прогрессе.
export async function hasActiveApplication(): Promise<boolean> {
    const currentUser = getUser()
    if (!currentUser) return false
    const apps = await getMyApplications()
    return apps.some(a => a.status === 'pending' || a.status === 'approved')
}

// GET /public/invitations/:token/form — публичный, без авторизации
export async function getInvitationForm(token: string): Promise<InvitationForm> {
    try {
        const data = await apiFetch<any>(`/public/invitations/${token}/form`, { skipAuthRedirect: true })
        return {
            cohort: { id: data.cohort.id, title: data.cohort.title },
            tracks: data.tracks.map((t: any) => ({ id: t.id, title: t.title })),
            questions: (data.survey?.questions ?? []).map(mapQuestion),
        }
    } catch (err: unknown) {
        const code = (err as { details?: { code?: string } } | undefined)?.details?.code
        if (code === 'INVALID_TOKEN') throw new Error('Ссылка недействительна')
        if (code === 'TOKEN_EXPIRED') throw new Error('Срок действия ссылки истёк')
        if (code === 'APPLICATION_WINDOW_CLOSED') throw new Error('Приём заявок в эту когорту сейчас закрыт')
        throw err instanceof Error ? err : new Error('Не удалось загрузить анкету')
    }
}

// POST /public/invitations/:token/applications — требует авторизации
export async function submitApplication(
    token: string,
    trackId: string,
    answers: ApplicationAnswerDto[]
): Promise<Application> {
    const data = await apiFetch<any>(`/public/invitations/${token}/applications`, {
        method: 'POST',
        body: { track_id: trackId, answers },
    })
    return mapApplication(data)
}

// GET /me/applications — архив заявок ТЕКУЩЕГО студента
export async function getMyApplications(): Promise<Application[]> {
    const data = await apiFetch<any[]>('/me/applications')
    return data.map(mapApplication)
}

// GET /me/applications/:id — одна заявка
export async function getMyApplication(applicationId: string): Promise<Application> {
    return mapApplication(await apiFetch<any>(`/me/applications/${applicationId}`))
}

// ── Админ: видит заявки ВСЕХ студентов ────────────────────────────

// GET /cohorts/:id/applications (ADMIN) — все заявки когорты
export async function getAllApplications(cohortId: string): Promise<Application[]> {
    const data = await apiFetch<any[]>(`/cohorts/${cohortId}/applications`)
    return data.map(mapApplication)
}

// GET /cohorts/:cohortId/applications/:applicationId (ADMIN)
export async function getApplicationForCohort(cohortId: string, applicationId: string): Promise<Application> {
    return mapApplication(await apiFetch<any>(`/cohorts/${cohortId}/applications/${applicationId}`))
}

// PATCH /cohorts/:cohortId/applications/:applicationId/status (ADMIN)
export async function updateApplicationStatus(
    cohortId: string,
    applicationId: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string
): Promise<Application> {
    const data = await apiFetch<any>(`/cohorts/${cohortId}/applications/${applicationId}/status`, {
        method: 'PATCH',
        body: {
            status: status.toUpperCase(),
            ...(status === 'rejected' ? { rejection_reason: rejectionReason ?? 'Не указана' } : {}),
        },
    })
    return mapApplication(data)
}
