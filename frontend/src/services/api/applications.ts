// services/api/applications.ts

import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface ApplicationAnswer {
    field_id: string
    value: string
}

export interface Application {
    id: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    review_comment: string | null
    created_at: string
    answers?: {
        id: string
        value: string
        field: {
            id: string
            label: string
            type: string
        }
    }[]
    role?: {
        id: string
        name: string
    } | null
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
}

// POST /applications — подать или перезаполнить заявку
export async function submitApplication(answers: ApplicationAnswer[]): Promise<Application> {
    const res = await fetch(`${API_URL}/applications`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ answers }),
    })
    const data = await res.json()
    if (!res.ok) {
        const msg = data.message || data.errors?.[0] || 'Не удалось подать заявку'
        throw new Error(msg)
    }
    // Бэк может вернуть {success, data} или напрямую объект
    if (data.success && data.data) return data.data
    return data
}

// GET /applications/my — заявка текущего студента
export async function getMyApplication(): Promise<Application | null> {
    const res = await fetch(`${API_URL}/applications/my`, {
        headers: authHeaders(),
    })
    if (res.status === 404) return null
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Не удалось загрузить заявку')
    }
    const data = await res.json()
    if (data.success && data.data) return data.data
    return data
}
