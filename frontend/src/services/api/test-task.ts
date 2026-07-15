// services/api/test-task.ts
//
// Реальный API — контракт списан 1:1 с backend/src/modules/test-task
// (см. docs/api-contract.md, docs/api/practice.md) и проверен вручную.

import { apiFetch } from '@/lib/api/http'
import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

// Совпадает с backend/src/shared/upload/upload-policy.ts (категория test-task-submissions)
export const ALLOWED_SUBMISSION_EXTENSIONS = ['.pdf', '.doc', '.docx', '.zip'] as const
export const MAX_SUBMISSION_SIZE_BYTES = 10 * 1024 * 1024 // 10 МБ, см. UPLOAD_MAX_FILE_SIZE_BYTES в .env.example backend

export interface SubmissionInfo {
    id: string
    fileName: string
    submittedAt: string
}

export type MyTestTask =
    | { available: false; message: string }
    | {
          available: true
          title: string
          description: string
          publishedAt: string
          hasFile: boolean
          downloadPath: string | null
          submission: SubmissionInfo | null
      }

export class SubmissionValidationError extends Error {}

// Проверка на клиенте до отправки — та же логика, что и на бэке
// (validateUploadCandidate), чтобы пользователь узнавал об ошибке сразу,
// а не после ожидания ответа сервера.
export function validateSubmissionFile(file: File): void {
    if (file.size <= 0) {
        throw new SubmissionValidationError('Пустой файл не может быть загружен')
    }
    if (file.size > MAX_SUBMISSION_SIZE_BYTES) {
        throw new SubmissionValidationError(
            `Размер файла превышает допустимый лимит (макс. ${MAX_SUBMISSION_SIZE_BYTES / (1024 * 1024)} МБ)`
        )
    }
    const dotIndex = file.name.lastIndexOf('.')
    const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : ''
    if (!ALLOWED_SUBMISSION_EXTENSIONS.includes(extension as (typeof ALLOWED_SUBMISSION_EXTENSIONS)[number])) {
        throw new SubmissionValidationError(
            `Тип файла не поддерживается. Разрешены: ${ALLOWED_SUBMISSION_EXTENSIONS.join(', ')}`
        )
    }
}

// GET /me/applications/:applicationId/test-task
export async function getMyTestTask(applicationId: string): Promise<MyTestTask> {
    const data = await apiFetch<any>(`/me/applications/${applicationId}/test-task`)
    if (!data.available) {
        return { available: false, message: data.message ?? 'Тестовое задание пока не опубликовано.' }
    }
    return {
        available: true,
        title: data.title,
        description: data.description ?? '',
        publishedAt: data.published_at,
        hasFile: Boolean(data.has_file),
        downloadPath: data.download_path ?? null,
        submission: data.submission
            ? { id: data.submission.id, fileName: data.submission.file_name ?? 'Файл решения', submittedAt: data.submission.submitted_at }
            : null,
    }
}

// PUT /me/applications/:applicationId/test-task-submission — загрузка/замена решения
export async function uploadSubmission(applicationId: string, file: File): Promise<SubmissionInfo> {
    validateSubmissionFile(file)

    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/me/applications/${applicationId}/test-task-submission`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить решение')
    return { id: data.id, fileName: data.file_name ?? file.name, submittedAt: data.submitted_at }
}

// GET /cohorts/:cohortId/applications/:applicationId/test-task-submission (ADMIN)
export async function getSubmissionForApplication(cohortId: string, applicationId: string): Promise<SubmissionInfo | null> {
    try {
        const data = await apiFetch<any>(`/cohorts/${cohortId}/applications/${applicationId}/test-task-submission`)
        return { id: data.id, fileName: data.file_name ?? 'Файл решения', submittedAt: data.submitted_at }
    } catch (err: unknown) {
        const code = (err as { details?: { code?: string } } | undefined)?.details?.code
        if (code === 'TEST_TASK_SUBMISSION_NOT_FOUND') return null
        throw err
    }
}
