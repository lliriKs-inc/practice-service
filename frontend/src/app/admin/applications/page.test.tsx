import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminApplicationsPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import { CohortWorkspaceContext, type CohortWorkspaceContextValue } from '../cohort-context'
import type { Application } from '@/services/api/invitation'
import type { Cohort } from '@/services/api/cohorts'

const COHORT_ID = 'cohort-1'

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

function seedApplications() {
    const apps: Application[] = [
        {
            id: 'app-pending',
            status: 'pending',
            submitted_at: '2027-07-05T00:00:00.000Z',
            track: { id: 'track-1', title: 'Backend' },
            cohort: { id: COHORT_ID, title: 'Практика 2027', start_date: '2027-07-01T00:00:00.000Z', end_date: '2027-07-31T00:00:00.000Z' },
            student: { id: 'student-1', email: 'anna@urfu.ru' },
            answers: [{ label: 'О себе', value: 'Люблю бэкенд' }],
        },
    ]
    localStorage.setItem('mock_applications', JSON.stringify(apps))
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
        seedApplications()
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

        const select = screen.getAllByRole('combobox')[0]
        fireEvent.change(select, { target: { value: 'rejected' } })

        expect(await screen.findByText('Заявок не найдено', {}, { timeout: 3000 })).toBeInTheDocument()
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

        // Дропдаун фильтра тоже содержит текст "Одобрена" (option), и кнопка на
        // время запроса меняет текст на "Сохраняем…" — ждём полного исчезновения
        // обоих вариантов (кнопка рендерится только для статуса pending)
        await waitFor(() => expect(screen.queryByRole('button', { name: /Одобрить|Сохраняем/ })).not.toBeInTheDocument(), { timeout: 3000 })
        const stored = JSON.parse(localStorage.getItem('mock_applications') ?? '[]')
        const app = stored.find((a: { id: string }) => a.id === 'app-pending')
        expect(app.status).toBe('approved')
    })
})
