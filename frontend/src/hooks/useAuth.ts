'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, getMe, type User } from '@/services/api/auth'
import { ApiError } from '@/lib/api/http'

export function useAuth(requiredRole?: 'ADMIN' | 'STUDENT') {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function verify() {
            const token = getToken()
            if (!token) {
                router.replace('/login')
                return
            }

            try {
                // Подтверждаем сессию у backend, а не доверяем только тому,
                // что лежит в localStorage — сервер может считать токен
                // истёкшим/невалидным, даже если он всё ещё сохранён локально.
                const userData = await getMe()
                if (cancelled) return

                if (requiredRole && userData.role !== requiredRole) {
                    // [FIX] Раньше при несовпадении роли просто молча кидало на
                    // /login без объяснений — человек не понимал, почему его
                    // выкинуло. Явно передаём причину, чтобы страница входа
                    // могла показать понятное сообщение.
                    router.replace('/login?reason=forbidden')
                    return
                }

                setUser(userData)
                setLoading(false)
            } catch (err) {
                if (cancelled) return
                // apiFetch уже очистил сессию и перенаправил при 401;
                // для остальных ошибок редиректим на login сами.
                if (!(err instanceof ApiError) || err.status !== 401) {
                    router.replace('/login')
                }
            }
        }

        verify()
        return () => { cancelled = true }
    }, [router, requiredRole])

    return { user, loading }
}
