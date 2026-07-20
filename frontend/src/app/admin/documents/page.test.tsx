import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import AdminDocumentsPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import { CohortWorkspaceContext, type CohortWorkspaceContextValue } from '../cohort-context'
import type { Cohort } from '@/services/api/cohorts'
import type { AdminDocumentSummary } from '@/services/api/admin'

const COHORT_ID = 'cohort-1'
const APP_ID = 'app-1'

const { getAdminDocuments, updateAdminDocumentField, updateReportStatus, getAdminApplicationDocumentDetail } = vi.hoisted(() => ({
    getAdminDocuments: vi.fn(),
    updateAdminDocumentField: vi.fn(),
    updateReportStatus: vi.fn(),
    getAdminApplicationDocumentDetail: vi.fn(),
}))

vi.mock('@/services/api/admin', () => ({ getAdminDocuments, updateAdminDocumentField, updateReportStatus }))
vi.mock('@/services/api/documents', async () => {
    const actual = await vi.importActual<typeof import('@/services/api/documents')>('@/services/api/documents')
    return { ...actual, getAdminApplicationDocumentDetail }
})

function loginAsAdmin() {
    saveToken('mock-jwt-admin-1')
    saveUser({ id: 'admin-1', email: 'admin@urfu.ru', role: 'ADMIN', created_at: '2026-01-01' })
}

function makeCohort(): Cohort {
    return {
        id: COHORT_ID,
        title: 'Практика 2027',
        status: 'active',
        start_date: '2027-07-01T00:00:00.000Z',
        end_date: '2027-07-31T00:00:00.000Z',
        created_at: '2027-06-01T00:00:00.000Z',
        tracks: [{ id: 'track-1', title: 'Backend', testTask: null }],
        survey: null,
        invitation: null,
    }
}

const DOCUMENT_TYPES = ['INDIVIDUAL_TASK', 'TITLE_PAGE', 'REVIEW', 'NOTICE'] as const

function makeDocumentSummary(overrides: Partial<AdminDocumentSummary> = {}): AdminDocumentSummary {
    return {
        applicationId: APP_ID,
        student: { id: 'student-1', email: 'anna@urfu.ru' },
        track: { id: 'track-1', title: 'Backend' },
        report: null,
        documents: DOCUMENT_TYPES.map(type => ({
            type,
            ready: false,
            missingFields: ['student_fio'],
            generated: false,
            generatedAt: null,
            downloadPath: null,
        })),
        ...overrides,
    }
}

function renderWithCohort() {
    const value: CohortWorkspaceContextValue = {
        cohorts: [makeCohort()],
        cohortsLoading: false,
        cohortsError: '',
        selectedCohortId: COHORT_ID,
        selectedCohort: makeCohort(),
        setSelectedCohortId: () => {},
        refetchCohorts: async () => {},
    }
    return render(
        <CohortWorkspaceContext.Provider value={value}>
            <AdminDocumentsPage />
        </CohortWorkspaceContext.Provider>
    )
}

describe('AdminDocumentsPage', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsAdmin()
        vi.clearAllMocks()
        getAdminDocuments.mockResolvedValue([makeDocumentSummary()])
        getAdminApplicationDocumentDetail.mockResolvedValue({
            applicationId: APP_ID,
            fieldValues: DOCUMENT_TYPES.map(type => ({ type, values: [] })),
        })
        updateAdminDocumentField.mockResolvedValue({ id: 'field-1', key: 'review_grade', value: 'Отлично', filledBy: 'ADMIN' })
        updateReportStatus.mockResolvedValue(undefined)
    })

    it('показывает карточку одобренной заявки со всеми 4 типами документов', async () => {
        renderWithCohort()
        expect(await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByText('Индивидуальное задание')).toBeInTheDocument()
        expect(screen.getByText('Титульный лист отчёта')).toBeInTheDocument()
        expect(screen.getByText('Отзыв руководителя практики')).toBeInTheDocument()
        expect(screen.getByText('Извещение о прохождении практики')).toBeInTheDocument()
        expect(screen.getByText('Отчёт: Не загружен')).toBeInTheDocument()
    })

    it('разворачивает детали и позволяет куратору сохранить поле отзыва (REVIEW)', async () => {
        renderWithCohort()
        await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })

        fireEvent.click(screen.getByText('▼ Показать детали и отзыв'))
        await waitFor(() => expect(screen.getAllByText('Отзыв руководителя практики').length).toBeGreaterThan(1), { timeout: 3000 })
        const occurrences = screen.getAllByText('Отзыв руководителя практики')
        const reviewCard = occurrences[occurrences.length - 1]
        const card = reviewCard.closest('div.border')! as HTMLElement

        const gradeLabel = within(card).getByText('Оценка')
        const gradeInput = gradeLabel.parentElement!.querySelector('input')!
        fireEvent.change(gradeInput, { target: { value: 'Отлично' } })
        fireEvent.blur(gradeInput)

        await waitFor(() => expect(updateAdminDocumentField).toHaveBeenCalledWith(COHORT_ID, APP_ID, 'REVIEW', 'review_grade', 'Отлично'))
    })

    it('одобряет загруженный отчёт', async () => {
        getAdminDocuments.mockResolvedValue([
            makeDocumentSummary({ report: { status: 'PENDING', uploadedAt: '2027-07-06T00:00:00.000Z', reviewedAt: null, rejectionReason: null, downloadPath: '/x' } }),
        ])
        renderWithCohort()

        expect(await screen.findByText('Отчёт: На проверке', {}, { timeout: 3000 })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Одобрить' }))

        await waitFor(() => expect(updateReportStatus).toHaveBeenCalledWith(COHORT_ID, APP_ID, 'APPROVED'))
    })

    it('фильтрует по готовности документов', async () => {
        renderWithCohort()
        await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })

        getAdminDocuments.mockResolvedValue([])
        const selects = screen.getAllByRole('combobox')
        const readinessSelect = selects[2] // трек / статус отчёта / готовность
        fireEvent.change(readinessSelect, { target: { value: 'READY' } })

        expect(await screen.findByText('Ничего не найдено', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(getAdminDocuments).toHaveBeenLastCalledWith(COHORT_ID, expect.objectContaining({ readiness: 'READY' }))
    })
})
