import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import AdminDocumentsPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import { CohortWorkspaceContext, type CohortWorkspaceContextValue } from '../cohort-context'
import type { Application } from '@/services/api/invitation'
import type { Cohort } from '@/services/api/cohorts'
import { uploadReport } from '@/services/api/documents'

const COHORT_ID = 'cohort-1'
const APP_ID = 'app-1'

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

function seedApprovedApplication() {
    const apps: Application[] = [{
        id: APP_ID,
        status: 'approved',
        submitted_at: '2027-07-05T00:00:00.000Z',
        track: { id: 'track-1', title: 'Backend' },
        cohort: { id: COHORT_ID, title: 'Практика 2027', start_date: '2027-07-01T00:00:00.000Z', end_date: '2027-07-31T00:00:00.000Z' },
        student: { id: 'student-1', email: 'anna@urfu.ru' },
        answers: [],
    }]
    localStorage.setItem('mock_applications', JSON.stringify(apps))
}

function makeFile(name: string, sizeBytes: number): File {
    const file = new File(['x'.repeat(Math.min(sizeBytes, 1024))], name, { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: sizeBytes })
    return file
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
        seedApprovedApplication()
    })

    it('показывает карточку одобренной заявки со всеми 4 типами документов', async () => {
        renderWithCohort()
        expect(await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByText('Индивидуальное задание')).toBeInTheDocument()
        expect(screen.getByText('Титульный лист отчёта')).toBeInTheDocument()
        expect(screen.getByText('Отзыв руководителя практики')).toBeInTheDocument()
        expect(screen.getByText('Направление на практику')).toBeInTheDocument()
        expect(screen.getByText('Отчёт: Не загружен')).toBeInTheDocument()
    })

    it('разворачивает детали и позволяет куратору сохранить поле отзыва (REVIEW)', async () => {
        renderWithCohort()
        await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })

        fireEvent.click(screen.getByText('▼ Показать детали и отзыв'))
        // "Отзыв руководителя практики" встречается дважды: в сводке типов сверху
        // и в развёрнутом блоке деталей — берём последнее вхождение (деталей)
        await waitFor(() => expect(screen.getAllByText('Отзыв руководителя практики').length).toBeGreaterThan(1), { timeout: 3000 })
        const occurrences = screen.getAllByText('Отзыв руководителя практики')
        const reviewCard = occurrences[occurrences.length - 1]
        const card = reviewCard.closest('div.border')! as HTMLElement

        const gradeLabel = within(card).getByText('Оценка')
        const gradeInput = gradeLabel.parentElement!.querySelector('input')!
        fireEvent.change(gradeInput, { target: { value: 'Отлично' } })
        fireEvent.blur(gradeInput)

        await waitFor(() => expect(within(card).queryByText('сохраняем…')).not.toBeInTheDocument(), { timeout: 3000 })
        expect(gradeInput).toHaveValue('Отлично')
    })

    it('одобряет загруженный отчёт', async () => {
        await uploadReport(APP_ID, makeFile('otchet.pdf', 1024))
        renderWithCohort()

        expect(await screen.findByText('Отчёт: На проверке', {}, { timeout: 3000 })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Одобрить' }))

        await waitFor(() => expect(screen.getByText('Отчёт: Одобрен')).toBeInTheDocument(), { timeout: 3000 })
        const stored = JSON.parse(localStorage.getItem('mock_reports') ?? '[]')
        expect(stored[0].status).toBe('APPROVED')
    })

    it('фильтрует по готовности документов', async () => {
        renderWithCohort()
        await screen.findByText('anna@urfu.ru', {}, { timeout: 3000 })

        const selects = screen.getAllByRole('combobox')
        const readinessSelect = selects[2] // трек / статус отчёта / готовность
        fireEvent.change(readinessSelect, { target: { value: 'READY' } })

        expect(await screen.findByText('Ничего не найдено', {}, { timeout: 3000 })).toBeInTheDocument()
    })
})
