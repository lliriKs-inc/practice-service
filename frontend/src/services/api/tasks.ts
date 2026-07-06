// services/api/tasks.ts

import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export interface Task {
    id: string
    user_id: string
    cohort_id: string
    date: string
    title: string
    description: string
    artifact_link: string | null
    updated_at: string
}

export interface CreateTaskDto {
    date: string
    title: string
    description: string
    artifact_link?: string | null
}

export interface WeekTasksResponse {
    weekStart: string
    weekEnd: string
    practiceStart: string
    practiceEnd: string
    tasks: Task[]
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
}

// POST /tasks
export async function createTask(dto: CreateTaskDto): Promise<Task> {
    const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось создать задачу')
    }
    return res.json()
}

// GET /tasks
export async function getTasks(): Promise<Task[]> {
    const res = await fetch(`${API_URL}/tasks`, {
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось загрузить задачи')
    return res.json()
}

// GET /tasks/week?weekStart=...
export async function getWeekTasks(weekStart: string): Promise<WeekTasksResponse> {
    const res = await fetch(`${API_URL}/tasks/week?weekStart=${weekStart}`, {
        headers: authHeaders(),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось загрузить задачи недели')
    }
    return res.json()
}

// PATCH /tasks/:id
export async function updateTask(id: string, dto: Partial<CreateTaskDto>): Promise<Task> {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось обновить задачу')
    }
    return res.json()
}

// DELETE /tasks/:id
export async function deleteTask(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось удалить задачу')
    }
}

// GET /tasks/all (ADMIN)
export async function getAllTasks(): Promise<Task[]> {
    const res = await fetch(`${API_URL}/tasks/all`, {
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось загрузить все задачи')
    return res.json()
}

// GET /tasks/all/week?weekStart=... (ADMIN)
export async function getAllWeekTasks(weekStart: string): Promise<WeekTasksResponse> {
    const res = await fetch(`${API_URL}/tasks/all/week?weekStart=${weekStart}`, {
        headers: authHeaders(),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось загрузить задачи недели')
    }
    return res.json()
}
