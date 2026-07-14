// services/api/test-task.ts
//
// ┌───────────────────────────────────────────────────────────────┐
// │ [MOCK] Как убрать моки, когда бэк будет готов:                │
// │  1. grep -rn "\[MOCK\]" services/  — найдёт все места в проекте│
// │  2. Здесь: поставить USE_MOCKS = false                        │
// │  3. Удалить блок "[MOCK-DATA]" ниже и все ветки if (USE_MOCKS) │
// │                                                                 │
// │ Контракт (пути, лимиты, разрешённые расширения) списан 1:1     │
// │ с реального backend-модуля test-task (backend/src/modules/     │
// │ test-task): GET/PUT /me/applications/:id/test-task[-submission]│
// │ и лимиты из backend/src/shared/upload/upload-policy.ts —       │
// │ это должно избавить от сюрпризов при переключении на реальный  │
// │ API.                                                            │
// └───────────────────────────────────────────────────────────────┘

import { getToken } from './auth'
import { getMyApplication } from './invitation'
import { mockPeekCohorts } from './cohorts'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// [MOCK-CONFIG] Единственный переключатель. false — реальные запросы к API.
export const USE_MOCKS = true

function mockDelay(ms = 400) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

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

function authHeaders() {
    return { Authorization: `Bearer ${getToken()}` }
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

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] — весь этот блок удаляется при отключении моков
// ════════════════════════════════════════════════════════════════

const MOCK_SUBMISSIONS_KEY = 'mock_test_task_submissions'

interface MockSubmission {
    id: string
    application_id: string
    fileName: string
    submittedAt: string
}

function mockUid() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2, 11)
}

function mockLoadSubmissions(): MockSubmission[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(MOCK_SUBMISSIONS_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function mockSaveSubmissions(subs: MockSubmission[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_SUBMISSIONS_KEY, JSON.stringify(subs))
}

// [MOCK-ONLY] вызывать из консоли браузера чтобы обнулить загруженные решения при тестировании
export function resetMockSubmissions() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(MOCK_SUBMISSIONS_KEY)
}

async function mockFindTrackTask(applicationId: string) {
    const application = await getMyApplication(applicationId)
    const cohort = mockPeekCohorts().find(c => c.id === application.cohort.id)
    const track = cohort?.tracks.find(t => t.id === application.track.id)
    return track?.testTask ?? null
}

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] конец блока
// ════════════════════════════════════════════════════════════════

// GET /me/applications/:applicationId/test-task
export async function getMyTestTask(applicationId: string): Promise<MyTestTask> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const task = await mockFindTrackTask(applicationId)

        if (!task || !task.publishedAt) {
            return {
                available: false,
                message: 'Тестовое задание пока не опубликовано. Оно будет направлено на email позже.',
            }
        }

        const submission = mockLoadSubmissions().find(s => s.application_id === applicationId) ?? null

        return {
            available: true,
            title: task.title,
            description: task.description,
            publishedAt: task.publishedAt,
            hasFile: Boolean(task.fileUrl),
            downloadPath: task.fileUrl,
            submission: submission
                ? { id: submission.id, fileName: submission.fileName, submittedAt: submission.submittedAt }
                : null,
        }
    }

    const res = await fetch(`${API_URL}/me/applications/${applicationId}/test-task`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Не удалось загрузить тестовое задание')
    const data = await res.json()
    if (!data.available) {
        return { available: false, message: data.message ?? 'Тестовое задание пока не опубликовано.' }
    }
    return {
        available: true,
        title: data.title,
        description: data.description,
        publishedAt: data.published_at,
        hasFile: data.has_file,
        downloadPath: data.download_path,
        submission: data.submission
            ? { id: data.submission.id, fileName: data.submission.file_name ?? 'Файл решения', submittedAt: data.submission.submitted_at }
            : null,
    }
}

// PUT /me/applications/:applicationId/test-task-submission — загрузка/замена решения
export async function uploadSubmission(applicationId: string, file: File): Promise<SubmissionInfo> {
    validateSubmissionFile(file)

    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay(700)

        const task = await mockFindTrackTask(applicationId)
        if (!task || !task.publishedAt) {
            throw new Error('Тестовое задание ещё не опубликовано — загрузка решения недоступна')
        }

        const submission: MockSubmission = {
            id: mockUid(),
            application_id: applicationId,
            fileName: file.name,
            submittedAt: new Date().toISOString(),
        }
        // Повторная загрузка заменяет предыдущее решение — храним только одну запись на заявку
        mockSaveSubmissions([
            ...mockLoadSubmissions().filter(s => s.application_id !== applicationId),
            submission,
        ])
        return { id: submission.id, fileName: submission.fileName, submittedAt: submission.submittedAt }
    }

    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/me/applications/${applicationId}/test-task-submission`, {
        method: 'PUT',
        headers: authHeaders(),
        body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить решение')
    return { id: data.id, fileName: file.name, submittedAt: data.submitted_at }
}

// GET /cohorts/:cohortId/applications/:applicationId/test-task-submission (ADMIN)
export async function getSubmissionForApplication(applicationId: string): Promise<SubmissionInfo | null> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay(150)
        const submission = mockLoadSubmissions().find(s => s.application_id === applicationId)
        return submission
            ? { id: submission.id, fileName: submission.fileName, submittedAt: submission.submittedAt }
            : null
    }

    const res = await fetch(`${API_URL}/applications/${applicationId}/test-task-submission`, { headers: authHeaders() })
    if (res.status === 404) return null
    if (!res.ok) throw new Error('Не удалось загрузить решение')
    const data = await res.json()
    return { id: data.id, fileName: data.file_name ?? 'Файл решения', submittedAt: data.submitted_at }
}
