// services/api/auth.ts

export interface LoginDto {
    email: string
    password: string
}

export interface RegisterDto {
    email: string
    password: string
    full_name: string
}

// ── localStorage helpers — вынесены в lib/api/session.ts, чтобы общий
// transport (lib/api/http.ts) мог их использовать без циклического импорта
// на services/api/auth.ts. Реэкспортируются здесь для обратной совместимости
// с существующими импортами из '@/services/api/auth'.
import {
    type SessionUser as User,
    saveToken,
    getToken,
    saveUser,
    getUser,
    isAuthenticated,
    clearSession,
} from '@/lib/api/session'
import { apiFetch } from '@/lib/api/http'

export {
    type User,
    saveToken,
    getToken,
    saveUser,
    getUser,
    isAuthenticated,
    clearSession as removeToken,
}

export function logout() {
    clearSession()
    void apiFetch('/auth/logout', { method: 'POST', skipAuthRedirect: true })
    window.location.href = '/'
}

// POST /auth/register
export async function register(dto: RegisterDto): Promise<User> {
    return apiFetch<User>('/auth/register', { method: 'POST', body: dto, skipAuthRedirect: true })
}

// POST /auth/login
export async function login(dto: LoginDto): Promise<void> {
    await apiFetch('/auth/login', { method: 'POST', body: dto, skipAuthRedirect: true })

    // получаем данные юзера отдельным запросом
    const user = await getMe()
    saveUser(user)
}

// GET /auth/me
export async function getMe(): Promise<User> {
    return apiFetch<User>('/auth/me')
}

// PATCH /auth/me/active-application
export async function selectActiveApplication(applicationId: string): Promise<User> {
    const user = await apiFetch<User>('/auth/me/active-application', {
        method: 'PATCH',
        body: { application_id: applicationId },
    })
    saveUser(user)
    return user
}
