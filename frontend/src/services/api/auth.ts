// services/api/auth.ts
// Все запросы связанные с авторизацией

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export interface LoginDto {
    email: string
    password: string
}

export interface RegisterDto {
    fio: string
    email: string
    password: string
}

export interface AuthResponse {
    token: string
    user: {
        id: string
        email: string
        fio: string
        role: 'ADMIN' | 'STUDENT'
    }
}

// Сохранить токен
export function saveToken(token: string) {
    localStorage.setItem('jwt', token)
}

// Получить токен
export function getToken(): string | null {
    return localStorage.getItem('jwt')
}

// Удалить токен (выход)
export function removeToken() {
    localStorage.removeItem('jwt')
    localStorage.removeItem('user')
}

// Сохранить данные пользователя
export function saveUser(user: AuthResponse['user']) {
    localStorage.setItem('user', JSON.stringify(user))
}

// Получить данные пользователя
export function getUser(): AuthResponse['user'] | null {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

// Проверить авторизован ли пользователь
export function isAuthenticated(): boolean {
    return !!getToken()
}

// Войти
export async function login(dto: LoginDto): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
    })

    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Ошибка входа')
    }

    const data: AuthResponse = await res.json()
    saveToken(data.token)
    saveUser(data.user)
    return data
}

// Зарегистрироваться
export async function register(dto: RegisterDto): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
    })

    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Ошибка регистрации')
    }

    const data: AuthResponse = await res.json()
    saveToken(data.token)
    saveUser(data.user)
    return data
}

// Выйти
export function logout() {
    removeToken()
    window.location.href = '/login'
}
