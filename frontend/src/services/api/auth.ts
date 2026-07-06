// services/api/auth.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface LoginDto {
    email: string
    password: string
}

export interface RegisterDto {
    email: string
    password: string
}

export interface User {
    id: string
    email: string
    role: 'ADMIN' | 'STUDENT'
    created_at: string
}

// ── localStorage helpers ──────────────────────

export function saveToken(token: string) {
    localStorage.setItem('jwt', token)
}

export function getToken(): string | null {
    return localStorage.getItem('jwt')
}

export function saveUser(user: User) {
    localStorage.setItem('user', JSON.stringify(user))
}

export function getUser(): User | null {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
}

export function isAuthenticated(): boolean {
    return !!getToken()
}

export function removeToken() {
    localStorage.removeItem('jwt')
    localStorage.removeItem('user')
}

export function logout() {
    removeToken()
    window.location.href = '/login'
}

// ── API helpers ───────────────────────────────

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
}

// ── Endpoints ────────────────────────────────

// POST /auth/register
export async function register(dto: RegisterDto): Promise<User> {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Ошибка регистрации')
    }
    return res.json()
}

// POST /auth/login
export async function login(dto: LoginDto): Promise<void> {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Неверный email или пароль')
    }
    const data = await res.json()
    saveToken(data.token)

    // получаем данные юзера отдельным запросом
    const user = await getMe()
    saveUser(user)
}

// GET /auth/me
export async function getMe(): Promise<User> {
    const res = await fetch(`${API_URL}/auth/me`, {
        headers: authHeaders(),
    })
    if (!res.ok) {
        throw new Error('Не удалось получить данные пользователя')
    }
    return res.json()
}
