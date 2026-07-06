// services/api/documents.ts

import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface StudentDocumentData {
    student_fio: string
    group: string
    direction_code: string
    direction_name: string
    program_name: string
    specialty: string
    practice_topic: string
    main_stage_tasks: string
    report_file_url?: string
    report_admin_approved?: boolean
}

export interface DocumentReadiness {
    individual_task: {
        ready: boolean
        missingFields: string[]
    }
    review: {
        ready: boolean
        missingFields: string[]
    }
    title_page: {
        ready: boolean
        missingFields: string[]
    }
}

export interface ReviewDto {
    userId: string
    review_activities: string
    review_characteristic: string
    review_employed: string
    review_next_practice: string
    review_employment_offer: string
    review_suggestions: string
    review_grade: string
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
}

// GET /documents
export async function getDocuments(): Promise<StudentDocumentData> {
    const res = await fetch(`${API_URL}/documents`, {
        headers: authHeaders(),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось загрузить документы')
    }
    return res.json()
}

// POST /documents
export async function initDocuments(): Promise<StudentDocumentData> {
    const res = await fetch(`${API_URL}/documents`, {
        method: 'POST',
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось инициализировать документы')
    return res.json()
}

// PATCH /documents
export async function updateDocuments(dto: Partial<StudentDocumentData>): Promise<StudentDocumentData> {
    const res = await fetch(`${API_URL}/documents`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось обновить документы')
    }
    return res.json()
}

// POST /documents/report (multipart)
export async function uploadReport(file: File): Promise<{ report_file_url: string }> {
    const formData = new FormData()
    formData.append('report', file)

    const res = await fetch(`${API_URL}/documents/report`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getToken()}`,
        },
        body: formData,
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось загрузить отчёт')
    }
    return res.json()
}

// PATCH /documents/review (ADMIN)
export async function updateReview(dto: ReviewDto): Promise<StudentDocumentData> {
    const res = await fetch(`${API_URL}/documents/review`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(dto),
    })
    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Не удалось сохранить отзыв')
    }
    return res.json()
}

// PATCH /documents/approve (ADMIN)
export async function approveReport(): Promise<void> {
    const res = await fetch(`${API_URL}/documents/approve`, {
        method: 'PATCH',
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось одобрить отчёт')
}

// GET /documents/readiness
export async function getDocumentReadiness(): Promise<DocumentReadiness> {
    const res = await fetch(`${API_URL}/documents/readiness`, {
        headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Не удалось проверить готовность документов')
    return res.json()
}

// GET /documents/generate/:type
export async function generateDocument(type: 'individual-task' | 'review' | 'title-page'): Promise<Blob> {
    const res = await fetch(`${API_URL}/documents/generate/${type}`, {
        headers: {
            'Authorization': `Bearer ${getToken()}`,
        },
    })
    if (!res.ok) throw new Error('Не удалось сгенерировать документ')
    return res.blob()
}
