// services/api/admin.ts
//
// ┌───────────────────────────────────────────────────────────────┐
// │ [MOCK] Как убрать моки, когда бэк будет готов:                │
// │  1. grep -rn "\[MOCK\]" services/  — найдёт все места в проекте│
// │  2. Здесь: поставить USE_MOCKS = false                        │
// │  3. Удалить блок "[MOCK-DATA]" ниже и все ветки if (USE_MOCKS) │
// │                                                                 │
// │ Контракт списан 1:1 с docs/api-contract.md (разделы            │
// │ "Административные заявки"/"документы") и                       │
// │ backend/src/modules/admin/admin.service.ts. В мок-режиме это    │
// │ агрегирующий слой поверх уже существующих mock-хранилищ         │
// │ (invitation.ts/test-task.ts/documents.ts/tasks.ts) — админ      │
// │ видит те же данные, что студенты реально создали, а не          │
// │ отдельную параллельную копию.                                   │
// └───────────────────────────────────────────────────────────────┘

import { getToken } from './auth'
import { getAllApplications, type Application } from './invitation'
import { getSubmissionForApplication, type SubmissionInfo } from './test-task'
import {
    getReadiness,
    getReport,
    updateAdminDocumentField,
    updateReportStatus,
    type DocumentType,
    type DocumentReadinessItem,
    type ReportInfo,
    type ReportStatus,
} from './documents'
import { getMissedDaysCount } from './tasks'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// [MOCK-CONFIG] Единственный переключатель. false — реальные запросы к API.
export const USE_MOCKS = true

function mockDelay(ms = 350) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    }
}

export interface AdminApplicationsFilter {
    status?: Application['status']
    trackId?: string
    search?: string
}

export interface AdminApplicationSummary {
    applicationId: string
    status: Application['status']
    submittedAt: string
    rejectionReason: string | null
    student: { id: string; email: string } | undefined
    track: { id: string; title: string }
    testTaskSubmission: SubmissionInfo | null
    report: ReportInfo | null
    missedDays: number
}

// GET /cohorts/:cohortId/admin/applications?status=&trackId=&search=
export async function getAdminApplications(
    cohortId: string,
    filters: AdminApplicationsFilter = {}
): Promise<AdminApplicationSummary[]> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()

        let applications = await getAllApplications(cohortId)
        if (filters.status) applications = applications.filter(a => a.status === filters.status)
        if (filters.trackId) applications = applications.filter(a => a.track.id === filters.trackId)
        if (filters.search) {
            const q = filters.search.trim().toLowerCase()
            applications = applications.filter(a => a.student?.email.toLowerCase().includes(q))
        }

        return Promise.all(
            applications.map(async app => ({
                applicationId: app.id,
                status: app.status,
                submittedAt: app.submitted_at,
                rejectionReason: null,
                student: app.student,
                track: app.track,
                testTaskSubmission: await getSubmissionForApplication(app.id),
                report: app.status === 'approved' ? await getReport(app.id) : null,
                missedDays: app.status === 'approved' ? await getMissedDaysCount(app.id) : 0,
            }))
        )
    }

    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status.toUpperCase())
    if (filters.trackId) params.set('trackId', filters.trackId)
    if (filters.search) params.set('search', filters.search)
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/admin/applications?${params}`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить заявки')
    return data
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
    student: { id: string; email: string } | undefined
    track: { id: string; title: string }
    report: ReportInfo | null
    documents: DocumentReadinessItem[]
}

// GET /cohorts/:cohortId/admin/documents — только одобренные заявки
export async function getAdminDocuments(
    cohortId: string,
    filters: AdminDocumentsFilter = {}
): Promise<AdminDocumentSummary[]> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()

        let applications = (await getAllApplications(cohortId)).filter(a => a.status === 'approved')
        if (filters.trackId) applications = applications.filter(a => a.track.id === filters.trackId)
        if (filters.studentId) applications = applications.filter(a => a.student?.id === filters.studentId)
        if (filters.search) {
            const q = filters.search.trim().toLowerCase()
            applications = applications.filter(a => a.student?.email.toLowerCase().includes(q))
        }

        const summaries: AdminDocumentSummary[] = await Promise.all(
            applications.map(async app => {
                const [readiness, report] = await Promise.all([getReadiness(app.id), getReport(app.id)])
                return {
                    applicationId: app.id,
                    student: app.student,
                    track: app.track,
                    report,
                    documents: readiness.documents,
                }
            })
        )

        return summaries.filter(s => {
            if (filters.reportStatus) {
                const status = s.report?.status ?? 'MISSING'
                if (status !== filters.reportStatus) return false
            }
            if (filters.readiness) {
                const documents = filters.documentType ? s.documents.filter(d => d.type === filters.documentType) : s.documents
                const ready = documents.every(d => d.ready)
                if (filters.readiness === 'READY' && !ready) return false
                if (filters.readiness === 'INCOMPLETE' && ready) return false
            }
            return true
        })
    }

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, String(value))
    }
    const res = await fetch(`${API_URL}/cohorts/${cohortId}/admin/documents?${params}`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить документы')
    return data
}

export interface AdminApplicationDetail extends AdminApplicationSummary {
    answers: { label: string; value: string }[]
}

// GET /cohorts/:cohortId/admin/applications/:applicationId
export async function getAdminApplicationDetail(cohortId: string, applicationId: string): Promise<AdminApplicationDetail> {
    if (USE_MOCKS) {
        // [MOCK]
        await mockDelay()

        const applications = await getAllApplications(cohortId)
        const app = applications.find(a => a.id === applicationId)
        if (!app) throw new Error('Заявка не найдена')

        const [testTaskSubmission, report, missedDays] = await Promise.all([
            getSubmissionForApplication(app.id),
            app.status === 'approved' ? getReport(app.id) : Promise.resolve(null),
            app.status === 'approved' ? getMissedDaysCount(app.id) : Promise.resolve(0),
        ])

        return {
            applicationId: app.id,
            status: app.status,
            submittedAt: app.submitted_at,
            rejectionReason: null,
            student: app.student,
            track: app.track,
            testTaskSubmission,
            report,
            missedDays,
            answers: app.answers ?? [],
        }
    }

    const res = await fetch(`${API_URL}/cohorts/${cohortId}/admin/applications/${applicationId}`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Не удалось загрузить заявку')
    return data
}

export { updateAdminDocumentField, updateReportStatus }
