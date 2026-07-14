// services/api/auth.ts
//
// ┌───────────────────────────────────────────────────────────────┐
// │ [MOCK] Как убрать моки, когда бэк будет готов:                │
// │  1. grep -rn "\[MOCK\]" services/  — найдёт все места в проекте│
// │  2. Здесь: поставить USE_MOCKS = false                        │
// │  3. Удалить блок "[MOCK-DATA]" ниже и все ветки if (USE_MOCKS) │
// │                                                                 │
// │ [MOCK-ACCOUNTS] Готовые аккаунты для входа без регистрации:   │
// │   Админ:      admin@urfu.ru   / admin12345                   │
// │   Практикант: student@urfu.ru / student123                    │
// │ Любой email с подстрокой "admin" при регистрации тоже станет  │
// │ админом — удобно если хочешь завести своего.                  │
// └───────────────────────────────────────────────────────────────┘

// [MOCK-CONFIG] Единственный переключатель. false — реальные запросы к API.
export const USE_MOCKS = true

// [MOCK] искусственная задержка для реалистичного UX загрузки
function mockDelay(ms = 400) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export interface LoginDto {
    email: string
    password: string
}

export interface RegisterDto {
    email: string
    password: string
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
    window.location.href = '/login'
}

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] — весь этот блок удаляется при отключении моков
// ════════════════════════════════════════════════════════════════

const MOCK_USERS_KEY = 'mock_users' // [MOCK] localStorage key — тоже подчистить

interface MockStoredUser extends User {
    password: string
}

function mockUid() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2, 11)
}

// [MOCK] сид-аккаунты — заводятся автоматически при первом обращении,
// чтобы можно было сразу логиниться без прохождения /register
const MOCK_SEED_USERS: MockStoredUser[] = [
    {
        id: 'mock-admin-1',
        email: 'admin@urfu.ru',
        password: 'admin12345',
        role: 'ADMIN',
        created_at: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 'mock-student-1',
        email: 'student@urfu.ru',
        password: 'student123',
        role: 'STUDENT',
        created_at: '2026-01-01T00:00:00.000Z',
    },
]

function mockLoadUsers(): MockStoredUser[] {
    if (typeof window === 'undefined') return MOCK_SEED_USERS
    try {
        const raw = localStorage.getItem(MOCK_USERS_KEY)
        if (!raw) {
            localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(MOCK_SEED_USERS))
            return MOCK_SEED_USERS
        }
        return JSON.parse(raw)
    } catch {
        return MOCK_SEED_USERS
    }
}

function mockSaveUsers(users: MockStoredUser[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users))
}

// [MOCK-ONLY] обнулить аккаунты до дефолтных двух при ручном тестировании
export function resetMockUsers() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(MOCK_USERS_KEY)
}

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] конец блока
// ════════════════════════════════════════════════════════════════

// POST /auth/register
export async function register(dto: RegisterDto): Promise<User> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const users = mockLoadUsers()
        if (users.some(u => u.email.toLowerCase() === dto.email.toLowerCase())) {
            throw new Error('Пользователь с таким email уже существует')
        }
        const user: MockStoredUser = {
            id: mockUid(),
            email: dto.email,
            password: dto.password,
            // [MOCK] простое правило: email с "admin" в адресе → роль ADMIN
            role: dto.email.toLowerCase().includes('admin') ? 'ADMIN' : 'STUDENT',
            created_at: new Date().toISOString(),
        }
        mockSaveUsers([...users, user])
        const { password: _password, ...publicUser } = user
        return publicUser
    }

    return apiFetch<User>('/auth/register', { method: 'POST', body: dto, skipAuthRedirect: true })
}

// POST /auth/login
export async function login(dto: LoginDto): Promise<void> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const users = mockLoadUsers()
        const found = users.find(u => u.email.toLowerCase() === dto.email.toLowerCase())
        if (!found || found.password !== dto.password) {
            throw new Error('Неверный email или пароль')
        }
        saveToken(`mock-jwt-${found.id}`)
        const { password: _password, ...publicUser } = found
        saveUser(publicUser)
        return
    }

    const data = await apiFetch<{ token: string }>('/auth/login', { method: 'POST', body: dto, skipAuthRedirect: true })
    saveToken(data.token)

    // получаем данные юзера отдельным запросом
    const user = await getMe()
    saveUser(user)
}

// GET /auth/me
export async function getMe(): Promise<User> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay(150)
        const user = getUser()
        if (!user) throw new Error('Не удалось получить данные пользователя')
        return user
    }

    return apiFetch<User>('/auth/me')
}
