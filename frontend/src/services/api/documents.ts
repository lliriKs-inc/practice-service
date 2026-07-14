// services/api/documents.ts
//
// ┌───────────────────────────────────────────────────────────────┐
// │ [MOCK] Как убрать моки, когда бэк будет готов:                │
// │  1. grep -rn "\[MOCK\]" services/  — найдёт все места в проекте│
// │  2. Здесь: поставить USE_MOCKS = false                        │
// │  3. Удалить блок "[MOCK-DATA]" ниже и все ветки if (USE_MOCKS) │
// │                                                                 │
// │ Контракт (маршруты, EAV-поля, лимиты) списан 1:1 с             │
// │ docs/api-contract.md (раздел "Reports и documents"),            │
// │ docs/api/documents.md и backend/src/modules/documents/          │
// │ document.config.ts — это должно избавить от сюрпризов при       │
// │ переключении на реальный API.                                   │
// │                                                                 │
// │ Старый клиент этого файла (StudentDocumentData, плоская форма) │
// │ был построен против несуществующего контракта и нигде не       │
// │ использовался — заменён полностью на EAV-модель.                │
// └───────────────────────────────────────────────────────────────┘

import { getToken } from './auth'
import { getMyApplication } from './invitation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// [MOCK-CONFIG] Единственный переключатель. false — реальные запросы к API.
export const USE_MOCKS = true

function mockDelay(ms = 350) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export type DocumentType = 'INDIVIDUAL_TASK' | 'TITLE_PAGE' | 'REVIEW' | 'NOTICE'

// Совпадает с backend/src/modules/documents/document.config.ts
export const DOCUMENT_TYPES: DocumentType[] = ['INDIVIDUAL_TASK', 'TITLE_PAGE', 'REVIEW', 'NOTICE']

// Slug-и для generate-эндпоинтов (docs/api/documents.md)
export const DOCUMENT_TYPE_SLUGS: Record<DocumentType, string> = {
    INDIVIDUAL_TASK: 'individual-task',
    TITLE_PAGE: 'title-page',
    REVIEW: 'review',
    NOTICE: 'notice',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
    INDIVIDUAL_TASK: 'Индивидуальное задание',
    TITLE_PAGE: 'Титульный лист отчёта',
    REVIEW: 'Отзыв руководителя практики',
    NOTICE: 'Направление на практику',
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

export interface ReadinessResponse {
    applicationId: string
    report: { status: ReportStatus; reviewedAt: string | null } | null
    documents: DocumentReadinessItem[]
}

export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

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

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
}

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

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] — весь этот блок удаляется при отключении моков
// ════════════════════════════════════════════════════════════════

const MOCK_DOCUMENTS_KEY = 'mock_documents'
const MOCK_REPORTS_KEY = 'mock_reports'

interface MockDocument {
    id: string
    application_id: string
    type: DocumentType
    generated: boolean
    generated_at: string | null
    fieldValues: DocumentFieldValue[]
}

interface MockReport {
    id: string
    application_id: string
    status: ReportStatus
    uploaded_at: string
    reviewed_at: string | null
    fileName: string
}

function mockUid() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return Math.random().toString(36).slice(2, 11)
}

function mockLoadDocuments(): MockDocument[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(MOCK_DOCUMENTS_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function mockSaveDocuments(docs: MockDocument[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_DOCUMENTS_KEY, JSON.stringify(docs))
}

function mockLoadReports(): MockReport[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(MOCK_REPORTS_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function mockSaveReports(reports: MockReport[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_REPORTS_KEY, JSON.stringify(reports))
}

// [MOCK-ONLY] обнулить документы/отчёты при ручном тестировании
export function resetMockDocuments() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(MOCK_DOCUMENTS_KEY)
    localStorage.removeItem(MOCK_REPORTS_KEY)
}

// [MOCK] Реальный backend делает upsert по всем 4 типам документов при первом
// обращении к заявке (ensureForApplication) — досеиваем недостающие записи так же лениво.
function mockEnsureDocuments(applicationId: string): MockDocument[] {
    const existing = mockLoadDocuments()
    const existingTypes = new Set(existing.filter(d => d.application_id === applicationId).map(d => d.type))
    const created: MockDocument[] = DOCUMENT_TYPES.filter(type => !existingTypes.has(type)).map(type => ({
        id: mockUid(),
        application_id: applicationId,
        type,
        generated: false,
        generated_at: null,
        fieldValues: [],
    }))
    if (created.length > 0) {
        mockSaveDocuments([...existing, ...created])
        return [...existing, ...created]
    }
    return existing
}

function mockBuildReadiness(applicationId: string, docs: MockDocument[], report: MockReport | null): DocumentReadinessItem[] {
    return DOCUMENT_TYPES.map(type => {
        const doc = docs.find(d => d.application_id === applicationId && d.type === type)
        const values = new Map((doc?.fieldValues ?? []).map(f => [f.key, f.value]))
        const missingFields = DOCUMENT_FIELD_CONFIG[type]
            .filter(f => f.required)
            .filter(f => !(values.get(f.key)?.trim()))
            .map(f => f.key)

        if (DOCUMENT_REQUIRES_APPROVED_REPORT[type] && report?.status !== 'APPROVED') {
            missingFields.push('report.status:APPROVED')
        }

        return {
            type,
            ready: missingFields.length === 0,
            missingFields,
            generated: doc?.generated ?? false,
            generatedAt: doc?.generated_at ?? null,
            downloadPath: doc?.generated
                ? `/me/applications/${applicationId}/documents/${type}/file`
                : null,
        }
    })
}

// ════════════════════════════════════════════════════════════════
// [MOCK-DATA] конец блока
// ════════════════════════════════════════════════════════════════

// GET /me/applications/:applicationId/documents/readiness
export async function getReadiness(applicationId: string): Promise<ReadinessResponse> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const application = await getMyApplication(applicationId)
        if (application.status !== 'approved') {
            throw new Error('Документы доступны только для одобренной заявки')
        }
        const docs = mockEnsureDocuments(applicationId)
        const report = mockLoadReports().find(r => r.application_id === applicationId) ?? null

        return {
            applicationId,
            report: report ? { status: report.status, reviewedAt: report.reviewed_at } : null,
            documents: mockBuildReadiness(applicationId, docs, report),
        }
    }

    const res = await fetch(`${API_URL}/me/applications/${applicationId}/documents/readiness`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить готовность документов')
    return data
}

// GET /me/applications/:applicationId/documents
export async function getDocuments(applicationId: string): Promise<DocumentData[]> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()
        const docs = mockEnsureDocuments(applicationId)
        return docs
            .filter(d => d.application_id === applicationId)
            .map(d => ({
                id: d.id,
                applicationId: d.application_id,
                type: d.type,
                generated: d.generated,
                generatedAt: d.generated_at,
                downloadPath: d.generated ? `/me/applications/${applicationId}/documents/${d.type}/file` : null,
                fieldValues: d.fieldValues,
            }))
    }

    const res = await fetch(`${API_URL}/me/applications/${applicationId}/documents`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить документы')
    return data
}

// PUT /me/applications/:applicationId/documents/:type/fields/:fieldKey
export async function updateDocumentField(
    applicationId: string,
    type: DocumentType,
    fieldKey: string,
    value: string
): Promise<DocumentFieldValue> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay(300)

        const fieldConfig = DOCUMENT_FIELD_CONFIG[type].find(f => f.key === fieldKey)
        if (!fieldConfig) throw new Error('Поле документа не найдено')
        if (fieldConfig.owner !== 'STUDENT') throw new Error('Это поле заполняет куратор, а не студент')

        const docs = mockEnsureDocuments(applicationId)
        const idx = docs.findIndex(d => d.application_id === applicationId && d.type === type)
        const doc = docs[idx]

        const existingFieldIdx = doc.fieldValues.findIndex(f => f.key === fieldKey)
        const fieldValue: DocumentFieldValue = {
            id: existingFieldIdx >= 0 ? doc.fieldValues[existingFieldIdx].id : mockUid(),
            key: fieldKey,
            value,
            filledBy: 'STUDENT',
        }
        const updatedFieldValues =
            existingFieldIdx >= 0
                ? doc.fieldValues.map((f, i) => (i === existingFieldIdx ? fieldValue : f))
                : [...doc.fieldValues, fieldValue]

        docs[idx] = { ...doc, fieldValues: updatedFieldValues }
        mockSaveDocuments(docs)
        return fieldValue
    }

    const res = await fetch(
        `${API_URL}/me/applications/${applicationId}/documents/${type}/fields/${fieldKey}`,
        { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ value }) }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось сохранить поле')
    return data
}

// GET /me/applications/:applicationId/documents/:type/generate
export async function generateDocument(applicationId: string, type: DocumentType): Promise<DocumentReadinessItem> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay(600)

        const docs = mockEnsureDocuments(applicationId)
        const idx = docs.findIndex(d => d.application_id === applicationId && d.type === type)
        const report = mockLoadReports().find(r => r.application_id === applicationId) ?? null
        const readiness = mockBuildReadiness(applicationId, docs, report).find(r => r.type === type)!
        if (!readiness.ready) {
            throw new Error('Документ ещё не готов — заполни все обязательные поля')
        }

        const generatedAt = new Date().toISOString()
        docs[idx] = { ...docs[idx], generated: true, generated_at: generatedAt }
        mockSaveDocuments(docs)

        return {
            type,
            ready: true,
            missingFields: [],
            generated: true,
            generatedAt,
            downloadPath: `/me/applications/${applicationId}/documents/${type}/file`,
        }
    }

    const res = await fetch(
        `${API_URL}/me/applications/${applicationId}/documents/${DOCUMENT_TYPE_SLUGS[type]}/generate`,
        { headers: authHeaders() }
    )
    if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Не удалось сгенерировать документ')
    }
    // На реальном API это бинарный DOCX-аттачмент — здесь просто подтверждаем факт генерации,
    // страница обновляет readiness отдельным запросом
    return { type, ready: true, missingFields: [], generated: true, generatedAt: new Date().toISOString(), downloadPath: null }
}

// GET /me/applications/:applicationId/report
export async function getReport(applicationId: string): Promise<ReportInfo | null> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay(200)
        const report = mockLoadReports().find(r => r.application_id === applicationId)
        if (!report) return null
        return {
            id: report.id,
            applicationId,
            status: report.status,
            uploadedAt: report.uploaded_at,
            reviewedAt: report.reviewed_at,
            hasFile: true,
            downloadPath: `/me/applications/${applicationId}/report/file`,
        }
    }

    const res = await fetch(`${API_URL}/me/applications/${applicationId}/report`, { headers: authHeaders() })
    if (res.status === 404) return null
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить отчёт')
    return data
}

// PUT /me/applications/:applicationId/report — загрузка/замена отчёта (сбрасывает статус в PENDING)
export async function uploadReport(applicationId: string, file: File): Promise<ReportInfo> {
    validateReportFile(file)

    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay(700)

        const reports = mockLoadReports()
        const existingIdx = reports.findIndex(r => r.application_id === applicationId)
        const report: MockReport = {
            id: existingIdx >= 0 ? reports[existingIdx].id : mockUid(),
            application_id: applicationId,
            status: 'PENDING',
            uploaded_at: new Date().toISOString(),
            reviewed_at: null,
            fileName: file.name,
        }
        if (existingIdx >= 0) {
            reports[existingIdx] = report
        } else {
            reports.push(report)
        }
        mockSaveReports(reports)

        return {
            id: report.id,
            applicationId,
            status: report.status,
            uploadedAt: report.uploaded_at,
            reviewedAt: report.reviewed_at,
            hasFile: true,
            downloadPath: `/me/applications/${applicationId}/report/file`,
        }
    }

    const formData = new FormData()
    formData.append('report', file)
    const res = await fetch(`${API_URL}/me/applications/${applicationId}/report`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить отчёт')
    return data
}
