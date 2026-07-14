// lib/api/session.ts
//
// Единое хранилище JWT-сессии в localStorage. Используется и API-клиентами
// (services/api/*.ts), и общим transport (lib/api/http.ts) — вынесено сюда,
// чтобы у обоих не было циклической зависимости друг на друга.

export interface SessionUser {
    id: string
    email: string
    role: 'ADMIN' | 'STUDENT'
    created_at: string
}

export function saveToken(token: string) {
    localStorage.setItem('jwt', token)
}

export function getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('jwt')
}

export function saveUser(user: SessionUser) {
    localStorage.setItem('user', JSON.stringify(user))
}

export function getUser(): SessionUser | null {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem('user')
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
}

export function isAuthenticated(): boolean {
    return !!getToken()
}

export function clearSession() {
    localStorage.removeItem('jwt')
    localStorage.removeItem('user')
}
