import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiError } from './http'
import { saveToken, saveUser, getToken } from './session'

const originalLocation = window.location

function mockFetchOnce(response: { status: number; body: unknown }) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        text: async () => JSON.stringify(response.body),
    }))
}

describe('apiFetch', () => {
    beforeEach(() => {
        localStorage.clear()
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, href: 'http://localhost/dashboard', pathname: '/dashboard', search: '' },
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    })

    it('возвращает данные при успешном ответе', async () => {
        mockFetchOnce({ status: 200, body: { success: true, data: { id: '1' } } })
        const result = await apiFetch<{ id: string }>('/anything')
        expect(result).toEqual({ id: '1' })
    })

    it('разворачивает голый JSON без конверта success/data', async () => {
        mockFetchOnce({ status: 200, body: [{ id: '1' }] })
        const result = await apiFetch<unknown[]>('/anything')
        expect(result).toEqual([{ id: '1' }])
    })

    it('бросает ApiError с сообщением от сервера при ошибке', async () => {
        mockFetchOnce({ status: 400, body: { message: 'Некорректные данные' } })
        await expect(apiFetch('/anything')).rejects.toMatchObject({
            name: 'ApiError',
            message: 'Некорректные данные',
            status: 400,
        })
    })

    it('при 401 очищает сессию и редиректит на /login', async () => {
        saveToken('stale-token')
        saveUser({ id: '1', email: 'a@a.ru', role: 'STUDENT', created_at: '2026-01-01' })
        mockFetchOnce({ status: 401, body: { message: 'Unauthorized' } })

        await expect(apiFetch('/protected')).rejects.toBeInstanceOf(ApiError)

        expect(getToken()).toBeNull()
        expect(window.location.href).toContain('/login?reason=session-expired')
    })

    it('не редиректит при 401, если передан skipAuthRedirect (например, сам login)', async () => {
        saveToken('stale-token')
        mockFetchOnce({ status: 401, body: { message: 'Неверный email или пароль' } })

        await expect(apiFetch('/auth/login', { skipAuthRedirect: true })).rejects.toBeInstanceOf(ApiError)

        expect(window.location.href).not.toContain('/login?reason=session-expired')
    })
})
