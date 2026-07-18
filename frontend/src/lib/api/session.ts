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
    // Реальный /auth/me отдаёт их тоже — опциональны, чтобы не трогать все
    // моковые фикстуры в тестах (там они не нужны, везде показываем email)
    full_name?: string
    active_cohort_id?: string | null
    active_application_id?: string | null
}

export function saveToken(token: string) {
    void token
}

export function getToken(): string | null {
    return null
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
    return !!getUser()
}

export function clearSession() {
    localStorage.removeItem('user')
}
