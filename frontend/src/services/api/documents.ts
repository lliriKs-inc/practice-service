// services/api/documents.ts
//
// Реальный API — контракт списан 1:1 с docs/api-contract.md (раздел "Reports
// и documents"), docs/api/documents.md и backend/src/modules/documents
// (document.config.ts, update-document-field.dto.ts, report-status.dto.ts),
// проверен вручную.

import { apiFetch } from '@/lib/api/http'
import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export type DocumentType = 'INDIVIDUAL_TASK' | 'TITLE_PAGE' | 'REVIEW' | 'NOTICE'

// Совпадает с backend/src/modules/documents/document.config.ts
export const DOCUMENT_TYPES: DocumentType[] = ['INDIVIDUAL_TASK', 'TITLE_PAGE', 'REVIEW', 'NOTICE']

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
    INDIVIDUAL_TASK: 'Индивидуальное задание',
    TITLE_PAGE: 'Титульный лист отчёта',
    REVIEW: 'Отзыв руководителя практики',
    NOTICE: 'Извещение о прохождении практики',
}

export interface DocumentFieldConfig {
    key: string
    label: string
    owner: 'STUDENT' | 'ADMIN'
    required: boolean
    multiline?: boolean
}

// Совпадает с DOCUMENT_CONFIG на бэке (ключи и владелец полей) — лейблы добавлены
// на фронте, т.к. backend их не отдаёт.
export const DOCUMENT_FIELD_CONFIG: Record<DocumentType, DocumentFieldConfig[]> = {
    INDIVIDUAL_TASK: [
        { key: 'student_fio', label: 'ФИО студента', owner: 'STUDENT', required: true },
        { key: 'group', label: 'Группа', owner: 'STUDENT', required: true },
        { key: 'direction_code', label: 'Код направления', owner: 'STUDENT', required: true },
        { key: 'direction_name', label: 'Название направления', owner: 'STUDENT', required: true },
        { key: 'program_name', label: 'Образовательная программа', owner: 'STUDENT', required: true },
        { key: 'practice_topic', label: 'Тема практики', owner: 'STUDENT', required: true },
        { key: 'main_stage_tasks', label: 'Задачи основного этапа', owner: 'STUDENT', required: true, multiline: true },
    ],
    TITLE_PAGE: [
        { key: 'student_fio', label: 'ФИО студента', owner: 'STUDENT', required: true },
        { key: 'group', label: 'Группа', owner: 'STUDENT', required: true },
        { key: 'specialty', label: 'Специальность', owner: 'STUDENT', required: true },
        { key: 'practice_topic', label: 'Тема практики', owner: 'STUDENT', required: true },
    ],
    REVIEW: [
        { key: 'student_fio', label: 'ФИО студента', owner: 'STUDENT', required: true },
        { key: 'group', label: 'Группа', owner: 'STUDENT', required: true },
        { key: 'review_activities', label: 'Виды деятельности', owner: 'ADMIN', required: true, multiline: true },
        { key: 'review_characteristic', label: 'Характеристика', owner: 'ADMIN', required: true, multiline: true },
        { key: 'review_employed', label: 'Трудоустроен', owner: 'ADMIN', required: true },
        { key: 'review_next_practice', label: 'Рекомендация к следующей практике', owner: 'ADMIN', required: true },
        { key: 'review_employment_offer', label: 'Предложение о трудоустройстве', owner: 'ADMIN', required: true },
        { key: 'review_suggestions', label: 'Пожелания', owner: 'ADMIN', required: true, multiline: true },
        { key: 'review_grade', label: 'Оценка', owner: 'ADMIN', required: true },
    ],
    NOTICE: [
        { key: 'student_fio', label: 'ФИО студента', owner: 'STUDENT', required: true },
        { key: 'group', label: 'Группа', owner: 'STUDENT', required: true },
        { key: 'practice_topic', label: 'Тема практики', owner: 'STUDENT', required: true },
    ],
}

// TITLE_PAGE требует одобренный отчёт — совпадает с requiresApprovedReport в document.config.ts
export const DOCUMENT_REQUIRES_APPROVED_REPORT: Record<DocumentType, boolean> = {
    INDIVIDUAL_TASK: false,
    TITLE_PAGE: true,
    REVIEW: false,
    NOTICE: false,
}

export interface DocumentFieldValue {
    id: string
    key: string
    value: string
    filledBy: 'STUDENT' | 'ADMIN'
}

export interface DocumentData {
    id: string
    applicationId: string
    type: DocumentType
    generated: boolean
    generatedAt: string | null
    downloadPath: string | null
    fieldValues: DocumentFieldValue[]
}

export interface DocumentReadinessItem {
    type: DocumentType
    ready: boolean
    missingFields: string[]
    generated: boolean
    generatedAt: string | null
    downloadPath: string | null
}

export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface ReadinessResponse {
    applicationId: string
    report: { status: ReportStatus; reviewedAt: string | null } | null
    documents: DocumentReadinessItem[]
}

export interface ReportInfo {
    id: string
    applicationId: string
    status: ReportStatus
    uploadedAt: string
    reviewedAt: string | null
    hasFile: boolean
    downloadPath: string
}

// Совпадает с backend/src/shared/upload/upload-policy.ts (категория reports)
export const ALLOWED_REPORT_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const
export const MAX_REPORT_SIZE_BYTES = 10 * 1024 * 1024

export class DocumentValidationError extends Error {}

export function validateReportFile(file: File): void {
    if (file.size <= 0) {
        throw new DocumentValidationError('Пустой файл не может быть загружен')
    }
    if (file.size > MAX_REPORT_SIZE_BYTES) {
        throw new DocumentValidationError(
            `Размер файла превышает допустимый лимит (макс. ${MAX_REPORT_SIZE_BYTES / (1024 * 1024)} МБ)`
        )
    }
    const dotIndex = file.name.lastIndexOf('.')
    const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : ''
    if (!ALLOWED_REPORT_EXTENSIONS.includes(extension as (typeof ALLOWED_REPORT_EXTENSIONS)[number])) {
        throw new DocumentValidationError(
            `Тип файла не поддерживается. Разрешены: ${ALLOWED_REPORT_EXTENSIONS.join(', ')}`
        )
    }
}

// Человекочитаемое сообщение для специального missingFields-маркера "report.status:APPROVED"
export function describeMissingField(type: DocumentType, missingKey: string): string {
    if (missingKey === 'report.status:APPROVED') {
        return 'Отчёт должен быть проверен и одобрен куратором'
    }
    return DOCUMENT_FIELD_CONFIG[type].find(f => f.key === missingKey)?.label ?? missingKey
}

function mapFieldValue(raw: any): DocumentFieldValue {
    return { id: raw.id, key: raw.key, value: raw.value, filledBy: raw.filled_by ?? raw.filledBy }
}

function mapDocument(raw: any, applicationId: string): DocumentData {
    return {
        id: raw.id,
        applicationId,
        type: raw.type,
        generated: Boolean(raw.generated),
        generatedAt: raw.generatedAt ?? null,
        downloadPath: raw.downloadPath ?? null,
        fieldValues: Array.isArray(raw.fieldValues) ? raw.fieldValues.map(mapFieldValue) : [],
    }
}

function mapReport(raw: any, applicationId: string): ReportInfo {
    return {
        id: raw.id,
        applicationId,
        status: raw.status,
        uploadedAt: raw.uploadedAt,
        reviewedAt: raw.reviewedAt ?? null,
        hasFile: true,
        downloadPath: raw.downloadPath,
    }
}

// GET /me/applications/:applicationId/documents/readiness
export async function getReadiness(applicationId: string): Promise<ReadinessResponse> {
    const data = await apiFetch<any>(`/me/applications/${applicationId}/documents/readiness`)
    return {
        applicationId,
        report: data.report ? { status: data.report.status, reviewedAt: data.report.reviewedAt ?? null } : null,
        documents: data.documents.map((d: any) => ({
            type: d.type,
            ready: Boolean(d.ready),
            missingFields: d.missingFields ?? [],
            generated: Boolean(d.generated),
            generatedAt: d.generatedAt ?? null,
            downloadPath: d.downloadPath ?? null,
        })),
    }
}

// GET /me/applications/:applicationId/documents
export async function getDocuments(applicationId: string): Promise<DocumentData[]> {
    const data = await apiFetch<any[]>(`/me/applications/${applicationId}/documents`)
    return data.map(d => mapDocument(d, applicationId))
}

// PUT /me/applications/:applicationId/documents/:type/fields/:fieldKey
export async function updateDocumentField(
    applicationId: string,
    type: DocumentType,
    fieldKey: string,
    value: string
): Promise<DocumentFieldValue> {
    const data = await apiFetch<any>(
        `/me/applications/${applicationId}/documents/${type}/fields/${fieldKey}`,
        { method: 'PUT', body: { value } }
    )
    return mapFieldValue(data)
}

// POST /me/applications/:applicationId/documents/:type/generate
export async function generateDocument(applicationId: string, type: DocumentType): Promise<DocumentReadinessItem> {
    const res = await fetch(
        `${API_URL}/me/applications/${applicationId}/documents/${type}/generate`,
        { method: 'POST', credentials: 'include' }
    )
    if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Не удалось сгенерировать документ')
    }
    // На реальном API это бинарный DOCX-аттачмент — здесь просто подтверждаем факт генерации,
    // страница обновляет readiness отдельным запросом
    return {
        type,
        ready: true,
        missingFields: [],
        generated: true,
        generatedAt: new Date().toISOString(),
        downloadPath: `/me/applications/${applicationId}/documents/${type}/file`,
    }
}

// GET /me/applications/:applicationId/report
export async function getReport(applicationId: string): Promise<ReportInfo | null> {
    // Backend всегда отвечает 200 (даже если отчёта ещё нет — тогда data: null),
    // а не 404 — статус-код здесь не индикатор отсутствия отчёта.
    const data = await apiFetch<any>(`/me/applications/${applicationId}/report`)
    if (!data) return null
    return mapReport(data, applicationId)
}

// PUT /me/applications/:applicationId/report — загрузка/замена отчёта (сбрасывает статус в PENDING)
export async function uploadReport(applicationId: string, file: File): Promise<ReportInfo> {
    validateReportFile(file)

    const formData = new FormData()
    formData.append('report', file)
    const res = await fetch(`${API_URL}/me/applications/${applicationId}/report`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить отчёт')
    return mapReport(data, applicationId)
}

// ── Админ (F-05): review-поля документов и решение по отчёту ──────

// PUT /cohorts/:cohortId/admin/applications/:applicationId/documents/:type/fields/:fieldKey
export async function updateAdminDocumentField(
    cohortId: string,
    applicationId: string,
    type: DocumentType,
    fieldKey: string,
    value: string
): Promise<DocumentFieldValue> {
    const data = await apiFetch<any>(
        `/cohorts/${cohortId}/admin/applications/${applicationId}/documents/${type}/fields/${fieldKey}`,
        { method: 'PUT', body: { value } }
    )
    return mapFieldValue(data)
}

// PATCH /cohorts/:cohortId/applications/:applicationId/report/status — решение куратора по отчёту
// (без причины отказа — совпадает с backend/.../dto/report-status.dto.ts, там только {status})
export async function updateReportStatus(
    cohortId: string,
    applicationId: string,
    status: Exclude<ReportStatus, 'PENDING'>
): Promise<ReportInfo> {
    const data = await apiFetch<any>(`/cohorts/${cohortId}/applications/${applicationId}/report/status`, {
        method: 'PATCH',
        body: { status },
    })
    return mapReport(data, applicationId)
}

export interface AdminDocumentFieldValues {
    type: DocumentType
    values: DocumentFieldValue[]
}

// GET /cohorts/:cohortId/admin/documents/:applicationId — значения полей всех 4 типов документов
export async function getAdminApplicationDocumentDetail(
    cohortId: string,
    applicationId: string
): Promise<{ applicationId: string; fieldValues: AdminDocumentFieldValues[] }> {
    const data = await apiFetch<any>(`/cohorts/${cohortId}/admin/documents/${applicationId}`)
    return {
        applicationId,
        fieldValues: (data.fieldValues ?? data).map((d: any) => ({
            type: d.type,
            values: (d.values ?? d.fieldValues ?? []).map(mapFieldValue),
        })),
    }
}
