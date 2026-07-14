// lib/api/http.ts
//
// Единая точка общения с backend. Все новые API-клиенты должны использовать
// apiFetch вместо собственного fetch-wrapper (см. F-00 в infa/ЗАДАЧИ_FRONTEND_DEVELOPER.md).
// Существующие services/api/*.ts мигрируют на него постепенно, вместе с
// фиче-задачами, а не одним махом здесь.

import { clearSession, getToken } from './session'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Единый формат ошибки API — вместо того, чтобы каждый вызывающий код сам
// разбирал res.ok/res.json()/err.message.
export class ApiError extends Error {
    readonly status: number
    readonly details: unknown

    constructor(message: string, status: number, details?: unknown) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.details = details
    }
}

// Бэкенд отдаёт либо голый JSON, либо конверт { success, data, message }.
// apiFetch разворачивает оба варианта, чтобы вызывающий код всегда получал
// только полезные данные.
interface ApiEnvelope<T> {
    success: boolean
    data: T
    message?: string
}

function isEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
    return typeof value === 'object' && value !== null && 'success' in value && 'data' in value
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
    body?: unknown
    /** Не редиректить на /login при 401 (например, сам login-запрос). */
    skipAuthRedirect?: boolean
}

async function parseBody(res: Response): Promise<unknown> {
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return text }
}

function redirectToLogin(reason: 'session-expired') {
    if (typeof window === 'undefined') return
    clearSession()
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = `/login?reason=${reason}&redirect=${next}`
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
    const { body, skipAuthRedirect, headers, ...rest } = options
    const token = getToken()

    const res = await fetch(`${API_URL}${path}`, {
        ...rest,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    const parsed = await parseBody(res)

    if (!res.ok) {
        const message =
            (typeof parsed === 'object' && parsed !== null && 'message' in parsed && typeof (parsed as { message?: unknown }).message === 'string'
                ? (parsed as { message: string }).message
                : null) || `Ошибка запроса (${res.status})`

        if (res.status === 401 && !skipAuthRedirect) {
            redirectToLogin('session-expired')
        }

        throw new ApiError(message, res.status, parsed)
    }

    if (isEnvelope<T>(parsed)) return parsed.data
    return parsed as T
}
