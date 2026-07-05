// hooks/useAuth.ts
// Хук для проверки авторизации и редиректа

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, getUser } from '@/services/api/auth'

interface User {
    id: string
    email: string
    fio: string
    role: 'ADMIN' | 'STUDENT'
}

export function useAuth(requiredRole?: 'ADMIN' | 'STUDENT') {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const token = getToken()
        const userData = getUser()

        if (!token || !userData) {
            router.replace('/login')
            return
        }

        if (requiredRole && userData.role !== requiredRole) {
            router.replace('/login')
            return
        }

        // откладываем setUser чтобы не вызвать каскад рендеров
        const timer = setTimeout(() => {
            setUser(userData)
            setLoading(false)
        }, 0)

        return () => clearTimeout(timer)
    }, [router, requiredRole])

    return { user, loading }
}
