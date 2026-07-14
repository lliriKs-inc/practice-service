import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardApplicationsPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Application } from '@/services/api/invitation'

const STUDENT = { id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT' as const, created_at: '2026-01-01' }

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser(STUDENT)
}

function seedApplications(apps: Application[]) {
    localStorage.setItem('mock_applications', JSON.stringify(apps))
}

function makeApplication(overrides: Partial<Application>): Application {
    return {
        id: 'app-1',
        status: 'pending',
        submitted_at: '2027-07-01T00:00:00.000Z',
        track: { id: 'track-1', title: 'Backend' },
        cohort: { id: 'cohort-1', title: 'Практика 2027', start_date: '2027-08-01', end_date: '2027-08-31' },
        student: { id: STUDENT.id, email: STUDENT.email },
        answers: [],
        ...overrides,
    }
}

describe('DashboardApplicationsPage (архив заявок студента)', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsStudent()
    })

    it('показывает пустое состояние, если заявок ещё нет', async () => {
        render(<DashboardApplicationsPage />)
        expect(await screen.findByText('Заявок пока нет')).toBeInTheDocument()
    })

    it('показывает только заявки текущего студента, не чужие', async () => {
        seedApplications([
            makeApplication({ id: 'mine', status: 'pending' }),
            makeApplication({ id: 'other', student: { id: 'other-student', email: 'x@x.ru' } }),
        ])
        render(<DashboardApplicationsPage />)

        expect(await screen.findByText('Практика 2027')).toBeInTheDocument()
        // Заявка чужого студента не должна отрисоваться вторым разом
        expect(screen.getAllByText('Практика 2027')).toHaveLength(1)
    })

    it('показывает статус заявки и ссылку на тестовое задание, если заявка не отклонена', async () => {
        seedApplications([makeApplication({ status: 'approved' })])
        render(<DashboardApplicationsPage />)

        expect(await screen.findByText('Одобрена')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Тестовое задание/ })).toHaveAttribute(
            'href',
            '/dashboard/applications/app-1/test-task'
        )
    })

    it('не показывает ссылку на тестовое задание для отклонённой заявки', async () => {
        seedApplications([makeApplication({ status: 'rejected' })])
        render(<DashboardApplicationsPage />)

        expect(await screen.findByText('Отклонена')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /Тестовое задание/ })).not.toBeInTheDocument()
    })
})
