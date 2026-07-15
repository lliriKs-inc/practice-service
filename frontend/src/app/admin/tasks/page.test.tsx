import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminTasksPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import { CohortWorkspaceContext, type CohortWorkspaceContextValue } from '../cohort-context'
import type { Cohort } from '@/services/api/cohorts'
import type { CohortWeekProgress, MissedProgress } from '@/services/api/tasks'

const COHORT_ID = 'cohort-1'

const { getCohortWeekProgress, getMissedProgress } = vi.hoisted(() => ({
    getCohortWeekProgress: vi.fn(),
    getMissedProgress: vi.fn(),
}))

vi.mock('@/services/api/tasks', async () => {
    const actual = await vi.importActual<typeof import('@/services/api/tasks')>('@/services/api/tasks')
    return { ...actual, getCohortWeekProgress, getMissedProgress }
})

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

// Понедельник за 2 недели до реального "сегодня" — чтобы дни точно были в прошлом.
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
const weekStart = practiceStart.toISOString().split('T')[0]
const weekEnd = new Date(practiceStart)
weekEnd.setUTCDate(weekEnd.getUTCDate() + 4)
const weekEndStr = weekEnd.toISOString().split('T')[0]

function makeWeekProgress(): CohortWeekProgress {
    return {
        cohort: { id: COHORT_ID, title: 'Практика', practiceStart: practiceStart.toISOString(), practiceEnd: practiceEnd.toISOString() },
        weekStart,
        weekEnd: weekEndStr,
        days: [weekStart],
        students: [
            {
                applicationId: 'app-1',
                student: { id: 'student-1', email: 'anna@urfu.ru' },
                track: { id: 'track-1', title: 'Backend' },
                tasks: [{ date: weekStart, task: null }],
            },
        ],
    }
}

function makeMissedProgress(): MissedProgress {
    return {
        cohortId: COHORT_ID,
        weekStart,
        weekEnd: weekEndStr,
        missed: [
            {
                applicationId: 'app-1',
                taskId: 'task-1',
                taskDate: weekStart,
                student: { id: 'student-1', email: 'anna@urfu.ru' },
                track: { id: 'track-1', title: 'Backend' },
                links: [],
            },
        ],
    }
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
        vi.clearAllMocks()
        getCohortWeekProgress.mockResolvedValue(makeWeekProgress())
        getMissedProgress.mockResolvedValue(makeMissedProgress())
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
