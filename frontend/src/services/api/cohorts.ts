// services/api/cohorts.ts

import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface Cohort {
    id: string
    name: string
    application_start: string
    application_end: string
    practice_start: string
    practice_end: string
}

export interface CreateCohortDto {
    name: string
    application_start: string
    application_end: string
    practice_start: string
    practice_end: string
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
}

// GET /cohorts
export async function getCohorts(): Promise<Cohort[]> {
    const res = await fetch(`${API_URL}/cohorts`, {
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось загрузить когорты')
    return res.json()
}

// GET /cohorts/:id
export async function getCohort(id: string): Promise<Cohort> {
    const res = await fetch(`${API_URL}/cohorts/${id}`, {
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Когорта не найдена')
    return res.json()
}

// POST /cohorts
export async function createCohort(dto: CreateCohortDto): Promise<Cohort> {
    const res = await fetch(`${API_URL}/cohorts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    if (!res.ok) throw new Error('Не удалось создать когорту')
    return res.json()
}

// PATCH /cohorts/:id
export async function updateCohort(id: string, dto: Partial<CreateCohortDto>): Promise<Cohort> {
    const res = await fetch(`${API_URL}/cohorts/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    if (!res.ok) throw new Error('Не удалось обновить когорту')
    return res.json()
}

// POST /cohorts/:id/activate
export async function activateCohort(id: string): Promise<{ message: string; active_cohort_id: string }> {
    const res = await fetch(`${API_URL}/cohorts/${id}/activate`, {
        method: 'POST',
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось активировать когорту')
    return res.json()
}

// GET /cohorts/active/me
export async function getActiveCohort(): Promise<{ active_cohort_id: string | null }> {
    const res = await fetch(`${API_URL}/cohorts/active/me`, {
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось получить активную когорту')
    return res.json()
}

// POST /cohorts/roles
export async function createRole(name: string): Promise<{ id: string; name: string; cohort_id: string }> {
    const res = await fetch(`${API_URL}/cohorts/roles`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error('Не удалось создать роль')
    return res.json()
}

// GET /cohorts/roles
export async function getRoles(): Promise<{ id: string; name: string; cohort_id: string }[]> {
    const res = await fetch(`${API_URL}/cohorts/roles`, {
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось загрузить роли')
    return res.json()
}
