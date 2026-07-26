import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import DashboardApplicationsPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Application } from '@/services/api/invitation'

const STUDENT = { id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT' as const, created_at: '2026-01-01' }

const { getMyApplications } = vi.hoisted(() => ({ getMyApplications: vi.fn() }))
vi.mock('@/services/api/invitation', () => ({ getMyApplications }))
const { getMe, selectActiveApplication } = vi.hoisted(() => ({
    getMe: vi.fn(),
    selectActiveApplication: vi.fn(),
}))
vi.mock('@/services/api/auth', () => ({ getMe, selectActiveApplication }))

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser(STUDENT)
}

function makeApplication(overrides: Partial<Application>): Application {
    return {
        id: 'app-1',
        status: 'pending',
        submitted_at: '2027-07-01T00:00:00.000Z',
        track: { id: 'track-1', title: 'Backend' },
        cohort: { id: 'cohort-1', title: 'Практика 2027', start_date: '2027-08-01', end_date: '2027-08-31', status: 'active' },
        student: { id: STUDENT.id, email: STUDENT.email },
        answers: [],
        ...overrides,
    }
}

describe('DashboardApplicationsPage (архив заявок студента)', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsStudent()
        vi.clearAllMocks()
        getMyApplications.mockResolvedValue([])
        getMe.mockResolvedValue({ ...STUDENT, active_application_id: null })
        selectActiveApplication.mockResolvedValue({ ...STUDENT, active_application_id: 'app-1' })
    })

    it('показывает пустое состояние, если заявок ещё нет', async () => {
        render(<DashboardApplicationsPage />)
        expect(await screen.findByText('Заявок пока нет')).toBeInTheDocument()
    })

    it('показывает заявку текущего студента (сервер уже возвращает только свои)', async () => {
        getMyApplications.mockResolvedValue([makeApplication({ id: 'mine', status: 'pending' })])
        render(<DashboardApplicationsPage />)

        expect(await screen.findByText('Практика 2027')).toBeInTheDocument()
        expect(screen.getAllByText('Практика 2027')).toHaveLength(1)
    })

    it('показывает статус заявки и ссылку на тестовое задание, если заявка не отклонена', async () => {
        getMyApplications.mockResolvedValue([makeApplication({ status: 'approved' })])
        render(<DashboardApplicationsPage />)

        const heading = await screen.findByText('Практика 2027')
        const card = heading.closest('.overflow-hidden') as HTMLElement
        expect(within(card).getByText('Одобрена')).toBeInTheDocument()
        expect(screen.getByText('Тестовое задание')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Перейти/ })).toHaveAttribute(
            'href',
            '/dashboard/applications/app-1/test-task'
        )
    })

    it('подсказывает выбрать трек при нескольких одобренных заявках без выбора', async () => {
        getMe.mockResolvedValue({ ...STUDENT, active_application_id: null })
        getMyApplications.mockResolvedValue([
            makeApplication({ id: 'app-1', status: 'approved' }),
            makeApplication({ id: 'app-2', status: 'approved', track: { id: 'track-2', title: 'Frontend' } }),
        ])
        render(<DashboardApplicationsPage />)

        expect(await screen.findByText('Выберите трек')).toBeInTheDocument()
    })

    it('запрашивает подтверждение перед выбором одного из нескольких одобренных треков', async () => {
        getMyApplications.mockResolvedValue([
            makeApplication({ id: 'app-1', status: 'approved' }),
            makeApplication({ id: 'app-2', status: 'approved', track: { id: 'track-2', title: 'Frontend' } }),
        ])
        render(<DashboardApplicationsPage />)

        fireEvent.click((await screen.findAllByRole('button', { name: 'Выбрать этот трек' }))[0])
        expect(screen.getByRole('heading', { name: 'Выбрать этот трек?' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Выбрать трек' }))
        await waitFor(() => expect(selectActiveApplication).toHaveBeenCalledWith('app-1'))
        expect(await screen.findByText('Выбранный трек')).toBeInTheDocument()
    })

    it('автоматически считает единственную одобренную заявку текущим треком, даже если явный выбор ещё не сохранён', async () => {
        getMyApplications.mockResolvedValue([makeApplication({ status: 'approved' })])
        render(<DashboardApplicationsPage />)

        expect(await screen.findByText('Выбранный трек')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Выбрать этот трек' })).not.toBeInTheDocument()
    })

    it('не показывает кнопку выбора трека у одобренной заявки, если другая заявка в той же когорте отклонена', async () => {
        getMyApplications.mockResolvedValue([
            makeApplication({ id: 'app-1', status: 'approved', track: { id: 'track-1', title: 'Backend' } }),
            makeApplication({ id: 'app-2', status: 'rejected', track: { id: 'track-2', title: 'Frontend' } }),
        ])
        render(<DashboardApplicationsPage />)

        expect(await screen.findByText('Выбранный трек')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Выбрать этот трек' })).not.toBeInTheDocument()
    })

    it('не показывает ссылку на тестовое задание для отклонённой заявки', async () => {
        getMyApplications.mockResolvedValue([makeApplication({
            status: 'rejected',
            rejection_reason: 'Выбран другой кандидат',
        })])
        render(<DashboardApplicationsPage />)

        // Отклонённая заявка уходит в архив — он свёрнут по умолчанию.
        fireEvent.click(await screen.findByText('Архив'))

        const heading = await screen.findByText('Практика 2027')
        const card = heading.closest('.overflow-hidden') as HTMLElement
        expect(within(card).getByText('Отклонена')).toBeInTheDocument()
        expect(screen.getByText('Причина отклонения')).toBeInTheDocument()
        expect(screen.getByText('Выбран другой кандидат')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /Тестовое задание/ })).not.toBeInTheDocument()
    })
})
