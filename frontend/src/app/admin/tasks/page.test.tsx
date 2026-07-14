import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminTasksPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import { CohortWorkspaceContext, type CohortWorkspaceContextValue } from '../cohort-context'
import type { Application } from '@/services/api/invitation'
import type { Cohort } from '@/services/api/cohorts'

const COHORT_ID = 'cohort-1'

function loginAsAdmin() {
    saveToken('mock-jwt-admin-1')
    saveUser({ id: 'admin-1', email: 'admin@urfu.ru', role: 'ADMIN', created_at: '2026-01-01' })
}

function makeCohort(startDate: string, endDate: string): Cohort {
    return {
        id: COHORT_ID,
        title: 'Практика',
        status: 'active',
        start_date: startDate,
        end_date: endDate,
        created_at: startDate,
        tracks: [{ id: 'track-1', title: 'Backend', testTask: null }],
        survey: null,
        invitation: null,
    }
}

// Понедельник за 2 недели до реального "сегодня" — чтобы дни точно были в прошлом
// (пропущенные дни считаются только если task_date <= сегодня).
function pastMonday(weeksAgo: number): Date {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - weeksAgo * 7)
    const day = d.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setUTCDate(d.getUTCDate() + diff)
    return d
}

const practiceStart = pastMonday(2)
const practiceEnd = new Date(practiceStart)
practiceEnd.setUTCDate(practiceEnd.getUTCDate() + 11)

function seedApprovedApplication() {
    const apps: Application[] = [{
        id: 'app-1',
        status: 'approved',
        submitted_at: practiceStart.toISOString(),
        track: { id: 'track-1', title: 'Backend' },
        cohort: { id: COHORT_ID, title: 'Практика', start_date: practiceStart.toISOString(), end_date: practiceEnd.toISOString() },
        student: { id: 'student-1', email: 'anna@urfu.ru' },
        answers: [],
    }]
    localStorage.setItem('mock_applications', JSON.stringify(apps))
}

function renderWithCohort() {
    const value: CohortWorkspaceContextValue = {
        cohorts: [makeCohort(practiceStart.toISOString(), practiceEnd.toISOString())],
        cohortsLoading: false,
        cohortsError: '',
        selectedCohortId: COHORT_ID,
        selectedCohort: makeCohort(practiceStart.toISOString(), practiceEnd.toISOString()),
        setSelectedCohortId: () => {},
        refetchCohorts: async () => {},
    }
    return render(
        <CohortWorkspaceContext.Provider value={value}>
            <AdminTasksPage />
        </CohortWorkspaceContext.Provider>
    )
}

describe('AdminTasksPage (прогресс когорты)', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsAdmin()
        seedApprovedApplication()
    })

    it('просит выбрать когорту, если не выбрана', async () => {
        const value: CohortWorkspaceContextValue = {
            cohorts: [], cohortsLoading: false, cohortsError: '',
            selectedCohortId: null, selectedCohort: null,
            setSelectedCohortId: () => {}, refetchCohorts: async () => {},
        }
        render(
            <CohortWorkspaceContext.Provider value={value}>
                <AdminTasksPage />
            </CohortWorkspaceContext.Provider>
        )
        expect(await screen.findByText('Выбери рабочую когорту', {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('показывает студента когорты в недельной таблице', async () => {
        renderWithCohort()
        expect((await screen.findAllByText('anna@urfu.ru', {}, { timeout: 3000 })).length).toBeGreaterThan(0)
    })

    it('показывает раздел с пропущенными днями, если они есть', async () => {
        renderWithCohort()
        expect(await screen.findByText('⚠️ Пропущенные дни на этой неделе', {}, { timeout: 3000 })).toBeInTheDocument()
    })
})
