import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import DashboardDocumentsPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Application } from '@/services/api/invitation'
import {
    DOCUMENT_TYPES,
    DOCUMENT_FIELD_CONFIG,
    DOCUMENT_REQUIRES_APPROVED_REPORT,
    type DocumentType,
    type DocumentData,
    type DocumentFieldValue,
    type ReadinessResponse,
    type ReportInfo,
    type ReportStatus,
} from '@/services/api/documents'

const APPLICATION_ID = 'app-1'

const { getMyApplications } = vi.hoisted(() => ({ getMyApplications: vi.fn() }))
vi.mock('@/services/api/invitation', () => ({ getMyApplications }))
const { getMe } = vi.hoisted(() => ({ getMe: vi.fn() }))
vi.mock('@/services/api/auth', () => ({ getMe }))

const {
    getReadiness,
    getDocuments,
    updateDocumentField,
    generateDocument,
    getReport,
    uploadReport,
} = vi.hoisted(() => ({
    getReadiness: vi.fn(),
    getDocuments: vi.fn(),
    updateDocumentField: vi.fn(),
    generateDocument: vi.fn(),
    getReport: vi.fn(),
    uploadReport: vi.fn(),
}))

vi.mock('@/services/api/documents', async () => {
    const actual = await vi.importActual<typeof import('@/services/api/documents')>('@/services/api/documents')
    return { ...actual, getReadiness, getDocuments, updateDocumentField, generateDocument, getReport, uploadReport }
})

// getByLabelText полагается на нативную ассоциацию label[for]/input.labels,
// которая в jsdom нестабильна для динамически смонтированных узлов — ищем
// поле напрямую через label -> соседний input/textarea в том же блоке.
function getFieldInput(container: HTMLElement, labelText: RegExp): HTMLInputElement | HTMLTextAreaElement {
    const label = within(container).getByText(labelText, { selector: 'label' })
    const field = label.parentElement!.querySelector('input, textarea')
    if (!field) throw new Error(`Не нашла поле рядом с лейблом ${labelText}`)
    return field as HTMLInputElement | HTMLTextAreaElement
}

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser({ id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01' })
}

function makeApplication(status: Application['status']): Application {
    return {
        id: APPLICATION_ID,
        status,
        submitted_at: '2027-07-01T00:00:00.000Z',
        track: { id: 'track-1', title: 'Backend' },
        cohort: { id: 'cohort-1', title: 'Практика 2027', start_date: '2027-07-19T00:00:00.000Z', end_date: '2027-07-30T00:00:00.000Z' },
        student: { id: 'student-1', email: 'student@urfu.ru' },
        answers: [],
    }
}

// ── Простое in-memory состояние документов/отчёта для этого теста ─────
// (воспроизводит старую мок-логику documents.ts, которая была удалена
// при переходе на реальный API — здесь она нужна, чтобы проверить, что
// страница правильно реагирует на смену readiness после сохранения поля)
let fieldStore: Record<DocumentType, DocumentFieldValue[]>
let reportStore: ReportInfo | null

function resetStore() {
    fieldStore = { INDIVIDUAL_TASK: [], TITLE_PAGE: [], REVIEW: [], NOTICE: [] }
    reportStore = null
}

function buildReadiness(): ReadinessResponse {
    const documents = DOCUMENT_TYPES.map(type => {
        const values = new Map(fieldStore[type].map(f => [f.key, f.value]))
        const missingFields = DOCUMENT_FIELD_CONFIG[type]
            .filter(f => f.required)
            .filter(f => !(values.get(f.key)?.trim()))
            .map(f => f.key)
        if (DOCUMENT_REQUIRES_APPROVED_REPORT[type] && reportStore?.status !== 'APPROVED') {
            missingFields.push('report.status:APPROVED')
        }
        return { type, ready: missingFields.length === 0, missingFields, generated: false, generatedAt: null, downloadPath: null }
    })
    return { applicationId: APPLICATION_ID, report: reportStore ? { status: reportStore.status, reviewedAt: reportStore.reviewedAt, rejectionReason: reportStore.rejectionReason } : null, documents }
}

function buildDocuments(): DocumentData[] {
    return DOCUMENT_TYPES.map(type => ({
        id: `doc-${type}`,
        applicationId: APPLICATION_ID,
        type,
        generated: false,
        generatedAt: null,
        downloadPath: null,
        fieldValues: fieldStore[type],
    }))
}

function setupDocumentsMocks() {
    getReadiness.mockImplementation(async () => buildReadiness())
    getDocuments.mockImplementation(async () => buildDocuments())
    getReport.mockImplementation(async () => reportStore)
    updateDocumentField.mockImplementation(async (_appId: string, type: DocumentType, fieldKey: string, value: string) => {
        const existingIdx = fieldStore[type].findIndex(f => f.key === fieldKey)
        const fieldValue: DocumentFieldValue = { id: `field-${type}-${fieldKey}`, key: fieldKey, value, filledBy: 'STUDENT' }
        if (existingIdx >= 0) fieldStore[type][existingIdx] = fieldValue
        else fieldStore[type].push(fieldValue)
        return fieldValue
    })
    generateDocument.mockImplementation(async (_appId: string, type: DocumentType) => {
        const readiness = buildReadiness().documents.find(d => d.type === type)!
        if (!readiness.ready) throw new Error('Документ ещё не готов — заполни все обязательные поля')
        return { ...readiness, generated: true, generatedAt: new Date().toISOString() }
    })
    uploadReport.mockImplementation(async () => {
        reportStore = { id: 'report-1', applicationId: APPLICATION_ID, status: 'PENDING' as ReportStatus, uploadedAt: new Date().toISOString(), reviewedAt: null, rejectionReason: null, hasFile: true, downloadPath: '/x' }
        return reportStore
    })
}

describe('DashboardDocumentsPage', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsStudent()
        getMe.mockResolvedValue({
            id: 'student-1',
            email: 'student@urfu.ru',
            role: 'STUDENT',
            created_at: '2026-01-01',
            active_application_id: APPLICATION_ID,
        })
        vi.clearAllMocks()
        resetStore()
        setupDocumentsMocks()
    })

    it('показывает заглушку "недоступны", если нет одобренной заявки', async () => {
        getMyApplications.mockResolvedValue([makeApplication('pending')])
        render(<DashboardDocumentsPage />)

        expect(await screen.findByText('Документы пока недоступны', {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('просит выбрать рабочий трек вместо подстановки первой из нескольких заявок', async () => {
        getMe.mockResolvedValue({
            id: 'student-1',
            email: 'student@urfu.ru',
            role: 'STUDENT',
            created_at: '2026-01-01',
            active_application_id: null,
        })
        getMyApplications.mockResolvedValue([
            makeApplication('approved'),
            { ...makeApplication('approved'), id: 'app-2', track: { id: 'track-2', title: 'Frontend' } },
        ])
        render(<DashboardDocumentsPage />)

        expect(await screen.findByText('Выберите рабочий трек')).toBeInTheDocument()
        expect(getReadiness).not.toHaveBeenCalled()
    })

    it('показывает карточки всех 4 типов документов и раздел отчёта для одобренной заявки', async () => {
        getMyApplications.mockResolvedValue([makeApplication('approved')])
        render(<DashboardDocumentsPage />)

        expect(await screen.findByText('Индивидуальное задание', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByText('Титульный лист отчёта')).toBeInTheDocument()
        expect(screen.getByText('Отзыв руководителя практики')).toBeInTheDocument()
        expect(screen.getByText('Извещение о прохождении практики')).toBeInTheDocument()
        expect(screen.getByText('Отчёт ещё не загружен')).toBeInTheDocument()
        expect(screen.getAllByText('(заполняет куратор)').length).toBeGreaterThan(0)
    })

    it('сохраняет поле по blur и разблокирует кнопку "Сформировать" после заполнения всех полей NOTICE', async () => {
        getMyApplications.mockResolvedValue([makeApplication('approved')])
        render(<DashboardDocumentsPage />)

        await screen.findByText('Извещение о прохождении практики', {}, { timeout: 3000 })
        const noticeCard = screen.getByText('Извещение о прохождении практики').closest('div.bg-white') as HTMLElement

        const fioInput = getFieldInput(noticeCard, /ФИО студента/)
        fireEvent.change(fioInput, { target: { value: 'Иванов Иван' } })
        fireEvent.blur(fioInput)
        await waitFor(() => expect(screen.queryByText('сохраняем…')).not.toBeInTheDocument(), { timeout: 3000 })

        const groupInput = getFieldInput(noticeCard, /Группа/)
        fireEvent.change(groupInput, { target: { value: 'РИ-123' } })
        fireEvent.blur(groupInput)
        await waitFor(() => expect(screen.queryByText('сохраняем…')).not.toBeInTheDocument(), { timeout: 3000 })

        const topicInput = getFieldInput(noticeCard, /Тема практики/)
        fireEvent.change(topicInput, { target: { value: 'Тема практики' } })
        fireEvent.blur(topicInput)

        await waitFor(() => {
            expect(within(noticeCard).getByText('✅ Готов к формированию')).toBeInTheDocument()
        }, { timeout: 3000 })

        const generateButton = within(noticeCard).getByRole('button', { name: /Сформировать/ })
        expect(generateButton).not.toBeDisabled()
    })

    it('показывает готовность документа НЕготовым, если требуется одобренный отчёт (TITLE_PAGE)', async () => {
        getMyApplications.mockResolvedValue([makeApplication('approved')])
        render(<DashboardDocumentsPage />)

        await screen.findByText('Титульный лист отчёта', {}, { timeout: 3000 })
        const card = screen.getByText('Титульный лист отчёта').closest('div.bg-white') as HTMLElement

        for (const [label, value] of [
            [/ФИО студента/, 'Иванов Иван'],
            [/Группа/, 'РИ-123'],
            [/Специальность/, 'ПИ'],
            [/Тема практики/, 'Тема практики'],
        ] as const) {
            const input = getFieldInput(card, label)
            fireEvent.change(input, { target: { value } })
            fireEvent.blur(input)
            await waitFor(() => expect(screen.queryByText('сохраняем…')).not.toBeInTheDocument(), { timeout: 3000 })
        }

        expect(await within(card).findByText(/одобрен куратором/, {}, { timeout: 3000 })).toBeInTheDocument()
        expect(within(card).getByRole('button', { name: /Сформировать/ })).toBeDisabled()
    }, 15000)
})
