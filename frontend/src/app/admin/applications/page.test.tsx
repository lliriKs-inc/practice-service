import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminApplicationsPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import { CohortWorkspaceContext, type CohortWorkspaceContextValue } from '../cohort-context'
import type { Cohort } from '@/services/api/cohorts'
import type { AdminApplicationSummary, AdminApplicationDetail } from '@/services/api/admin'

const COHORT_ID = 'cohort-1'

const { getAdminApplications, getAdminApplicationDetail, updateApplicationStatus } = vi.hoisted(() => ({
    getAdminApplications: vi.fn(),
    getAdminApplicationDetail: vi.fn(),
    updateApplicationStatus: vi.fn(),
}))

vi.mock('@/services/api/admin', () => ({ getAdminApplications, getAdminApplicationDetail }))
vi.mock('@/services/api/invitation', () => ({ updateApplicationStatus }))

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
        tracks: [
            { id: 'track-1', title: 'Backend', testTask: null },
            { id: 'track-2', title: 'Frontend', testTask: null },
        ],
        survey: null,
        invitation: null,
    }
}

function makeApplication(overrides: Partial<AdminApplicationSummary> = {}): AdminApplicationSummary {
    return {
        applicationId: 'app-pending',
        status: 'pending',
        submittedAt: '2027-07-05T00:00:00.000Z',
        rejectionReason: null,
        student: { id: 'student-1', email: 'anna@urfu.ru' },
        track: { id: 'track-1', title: 'Backend' },
        testTaskSubmission: null,
        report: null,
        missedDays: 0,
        ...overrides,
    }
}

function renderWithCohort(overrides: Partial<CohortWorkspaceContextValue> = {}) {
    const value: CohortWorkspaceContextValue = {
        cohorts: [makeCohort()],
        cohortsLoading: false,
        cohortsError: '',
        selectedCohortId: COHORT_ID,
        selectedCohort: makeCohort(),
        setSelectedCohortId: () => {},
        refetchCohorts: async () => {},
        ...overrides,
    }
    return render(
        <CohortWorkspaceContext.Provider value={value}>
            <AdminApplicationsPage />
        </CohortWorkspaceContext.Provider>
    )
}

describe('AdminApplicationsPage', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsAdmin()
        vi.clearAllMocks()
        getAdminApplications.mockResolvedValue([makeApplication()])
        getAdminApplicationDetail.mockResolvedValue({
            ...makeApplication(),
            answers: [{ label: 'О себе', value: 'Люблю бэкенд' }],
            documents: [],
        } satisfies AdminApplicationDetail)
        updateApplicationStatus.mockResolvedValue(undefined)
    })

    it('просит выбрать рабочую когорту, если она не выбрана', async () => {
        renderWithCohort({ selectedCohort: null, selectedCohortId: null })
        expect(await screen.findByText('Выбери рабочую когорту', {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('показывает заявку выбранной когорты', async () => {
        renderWithCohort()
        expect(await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('фильтрует заявки по статусу', async () => {
        renderWithCohort()
        await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })

        getAdminApplications.mockResolvedValue([])
        const select = screen.getAllByRole('combobox')[0]
        fireEvent.change(select, { target: { value: 'rejected' } })

        expect(await screen.findByText('Заявок не найдено', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(getAdminApplications).toHaveBeenLastCalledWith(COHORT_ID, expect.objectContaining({ status: 'rejected' }))
    })

    it('разворачивает и показывает ответы анкеты по клику', async () => {
        renderWithCohort()
        await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })

        fireEvent.click(screen.getByText('▼ Показать ответы анкеты'))
        expect(await screen.findByText('Люблю бэкенд', {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('одобряет заявку', async () => {
        renderWithCohort()
        await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })

        fireEvent.click(screen.getByRole('button', { name: 'Одобрить' }))

        await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledWith(COHORT_ID, 'app-pending', 'approved', undefined))
    })
})
