// services/api/admin.ts
//
// Реальный API — агрегирующие ADMIN-эндпоинты backend/src/modules/admin.
// Metadata решения тестового задания возвращается сразу в агрегате, чтобы
// список заявок не выполнял отдельный запрос для каждой карточки.

import { apiFetch } from '@/lib/api/http'
import { type SubmissionInfo } from './test-task'
import {
    updateAdminDocumentField,
    updateReportStatus,
    type DocumentType,
    type DocumentReadinessItem,
    type ReportStatus,
} from './documents'

export type AdminApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface AdminApplicationsFilter {
    status?: AdminApplicationStatus
    trackId?: string
    search?: string
}

export interface AdminReportSummary {
    status: ReportStatus
    uploadedAt: string
    reviewedAt: string | null
    rejectionReason: string | null
    downloadPath: string
}

export interface AdminApplicationSummary {
    applicationId: string
    status: AdminApplicationStatus
    submittedAt: string
    rejectionReason: string | null
    student: { id: string; email: string; full_name?: string } | undefined
    track: { id: string; title: string }
    testTaskSubmission: SubmissionInfo | null
    report: AdminReportSummary | null
    missedDays: number
}

function mapAdminReport(raw: any): AdminReportSummary | null {
    if (!raw) return null
    return { status: raw.status, uploadedAt: raw.uploadedAt, reviewedAt: raw.reviewedAt ?? null, rejectionReason: raw.rejectionReason ?? null, downloadPath: raw.downloadPath }
}

function mapAdminDocuments(raw: any[]): DocumentReadinessItem[] {
    return (raw ?? []).map(d => ({
        type: d.type,
        ready: Boolean(d.ready),
        missingFields: d.missingFields ?? [],
        generated: Boolean(d.generated),
        generatedAt: d.generatedAt ?? null,
        downloadPath: d.downloadPath ?? null,
    }))
}

function mapAdminApplicationBase(raw: any): Omit<AdminApplicationSummary, 'testTaskSubmission'> {
    return {
        applicationId: raw.applicationId,
        status: String(raw.status).toLowerCase() as AdminApplicationStatus,
        submittedAt: raw.submittedAt,
        rejectionReason: raw.rejectionReason ?? null,
        student: raw.student ?? undefined,
        track: raw.track,
        report: mapAdminReport(raw.report),
        missedDays: raw.missedDays ?? 0,
    }
}

function mapSubmission(raw: any): SubmissionInfo | null {
    if (!raw) return null
    return {
        id: raw.id,
        fileName: raw.fileName ?? 'Файл решения',
        submittedAt: raw.submittedAt,
        downloadPath: raw.downloadPath,
    }
}

// GET /cohorts/:cohortId/admin/applications?status=&trackId=&search=
export async function getAdminApplications(
    cohortId: string,
    filters: AdminApplicationsFilter = {}
): Promise<AdminApplicationSummary[]> {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status.toUpperCase())
    if (filters.trackId) params.set('trackId', filters.trackId)
    if (filters.search) params.set('search', filters.search)
    const qs = params.toString()
    const data = await apiFetch<any[]>(`/cohorts/${cohortId}/admin/applications${qs ? `?${qs}` : ''}`)

    return data.map(raw => ({
        ...mapAdminApplicationBase(raw),
        testTaskSubmission: mapSubmission(raw.testTaskSubmission),
    }))
}

export interface AdminDocumentsFilter {
    trackId?: string
    studentId?: string
    search?: string
    reportStatus?: 'MISSING' | ReportStatus
    documentType?: DocumentType
    readiness?: 'READY' | 'INCOMPLETE'
}

export interface AdminDocumentSummary {
    applicationId: string
    student: { id: string; email: string; full_name?: string } | undefined
    track: { id: string; title: string }
    report: AdminReportSummary | null
    documents: DocumentReadinessItem[]
}

// GET /cohorts/:cohortId/admin/documents — только одобренные заявки
export async function getAdminDocuments(
    cohortId: string,
    filters: AdminDocumentsFilter = {}
): Promise<AdminDocumentSummary[]> {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, String(value))
    }
    const qs = params.toString()
    const data = await apiFetch<any[]>(`/cohorts/${cohortId}/admin/documents${qs ? `?${qs}` : ''}`)
    return data.map(raw => ({
        applicationId: raw.applicationId,
        student: raw.student ?? undefined,
        track: raw.track,
        report: mapAdminReport(raw.report),
        documents: mapAdminDocuments(raw.documents),
    }))
}

export interface AdminApplicationDetail extends AdminApplicationSummary {
    answers: { label: string; value: string }[]
    documents: DocumentReadinessItem[]
}

// GET /cohorts/:cohortId/admin/applications/:applicationId
export async function getAdminApplicationDetail(cohortId: string, applicationId: string): Promise<AdminApplicationDetail> {
    const raw = await apiFetch<any>(`/cohorts/${cohortId}/admin/applications/${applicationId}`)
    return {
        ...mapAdminApplicationBase(raw),
        testTaskSubmission: mapSubmission(raw.testTaskSubmission),
        answers: (raw.answers ?? []).map((a: any) => ({ label: a.question?.label ?? 'Вопрос', value: a.value })),
        documents: mapAdminDocuments(raw.documents),
    }
}

export { updateAdminDocumentField, updateReportStatus }
