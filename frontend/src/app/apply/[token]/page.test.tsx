import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ApplyByInvitationPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Cohort } from '@/services/api/cohorts'

const mockUseParams = vi.fn()
vi.mock('next/navigation', () => ({
    useParams: () => mockUseParams(),
}))

const TOKEN = 'test-token'

// Кастомная когорта с вопросами всех типов — покрывает text/textarea/select/radio/checkbox
const FULL_COHORT: Cohort = {
    id: 'cohort-1',
    title: 'Практика 2027',
    status: 'active',
    start_date: '2027-08-01',
    end_date: '2027-08-31',
    created_at: '2027-07-01T00:00:00.000Z',
    tracks: [
        { id: 'track-backend', title: 'Backend', testTask: null },
        { id: 'track-frontend', title: 'Frontend', testTask: null },
    ],
    survey: {
        id: 'survey-1',
        title: 'Анкета',
        questions: [
            { id: 'q-text', label: 'ФИО', type: 'text', required: true, options: [], order_index: 1 },
            { id: 'q-textarea', label: 'О себе', type: 'textarea', required: false, options: [], order_index: 2 },
            { id: 'q-select', label: 'Курс', type: 'select', required: false, options: ['1', '2', '3'], order_index: 3 },
            { id: 'q-radio', label: 'Формат', type: 'radio', required: false, options: ['Очно', 'Удалённо'], order_index: 4 },
            { id: 'q-checkbox', label: 'Технологии', type: 'checkbox', required: false, options: ['React', 'Node'], order_index: 5 },
        ],
    },
    invitation: { token: TOKEN, expiresAt: null },
}

function seedCohort(cohort: Cohort) {
    localStorage.setItem('mock_cohorts', JSON.stringify([cohort]))
}

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser({ id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01' })
}

function loginAsAdmin() {
    saveToken('mock-jwt-admin-1')
    saveUser({ id: 'admin-1', email: 'admin@urfu.ru', role: 'ADMIN', created_at: '2026-01-01' })
}

function seedApplication(status: 'pending' | 'approved' | 'rejected') {
    localStorage.setItem('mock_applications', JSON.stringify([{
        id: 'existing-app',
        status,
        submitted_at: '2027-07-01T00:00:00.000Z',
        track: { id: 'track-backend', title: 'Backend' },
        cohort: { id: 'cohort-1', title: 'Практика 2027', start_date: '2027-08-01', end_date: '2027-08-31' },
        student: { id: 'student-1', email: 'student@urfu.ru' },
        answers: [],
    }]))
}

describe('ApplyByInvitationPage', () => {
    beforeEach(() => {
        localStorage.clear()
        mockUseParams.mockReturnValue({ token: TOKEN })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('показывает "Ссылка недействительна" для несуществующего токена', async () => {
        mockUseParams.mockReturnValue({ token: 'invalid' })
        render(<ApplyByInvitationPage />)

        expect(await screen.findByRole('heading', { name: 'Ссылка недействительна' })).toBeInTheDocument()
    })

    it('предлагает войти/зарегистрироваться, если пользователь не авторизован', async () => {
        seedCohort(FULL_COHORT)
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Приглашение на практику')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Войти →' })).toBeInTheDocument()
        expect(screen.getByText('Создать аккаунт')).toBeInTheDocument()
    })

    it('не даёт админу заполнить анкету по ссылке-приглашению', async () => {
        seedCohort(FULL_COHORT)
        loginAsAdmin()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Ссылка не для организаторов')).toBeInTheDocument()
        expect(screen.queryByText('Заявка на практику')).not.toBeInTheDocument()
    })

    it('не даёт подать новую заявку, если есть заявка на рассмотрении', async () => {
        seedCohort(FULL_COHORT)
        seedApplication('pending')
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('У тебя уже есть активная заявка')).toBeInTheDocument()
        expect(screen.queryByText('Заявка на практику')).not.toBeInTheDocument()
    })

    it('не даёт подать новую заявку, если есть уже одобренная', async () => {
        seedCohort(FULL_COHORT)
        seedApplication('approved')
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('У тебя уже есть активная заявка')).toBeInTheDocument()
    })

    it('разрешает подать новую заявку, если предыдущая была отклонена', async () => {
        seedCohort(FULL_COHORT)
        seedApplication('rejected')
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Заявка на практику')).toBeInTheDocument()
    })

    it('рендерит все типы вопросов анкеты и оба трека', async () => {
        seedCohort(FULL_COHORT)
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Заявка на практику')).toBeInTheDocument()
        expect(screen.getByText('Backend')).toBeInTheDocument()
        expect(screen.getByText('Frontend')).toBeInTheDocument()

        // text
        expect(screen.getAllByPlaceholderText('Ваш ответ').length).toBeGreaterThan(0)
        // select/radio отрисованы как переключатели-кнопки с вариантами
        expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Очно' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Удалённо' })).toBeInTheDocument()
        // checkbox
        expect(screen.getByText('React')).toBeInTheDocument()
        expect(screen.getByText('Node')).toBeInTheDocument()
    })

    it('требует выбрать трек перед отправкой', async () => {
        seedCohort(FULL_COHORT)
        loginAsStudent()
        const { container } = render(<ApplyByInvitationPage />)

        await screen.findByText('Заявка на практику')
        // Сабмитим форму напрямую — клик по кнопке уходит в нативную HTML5-валидацию
        // required-полей раньше, чем до неё доберётся наш собственный обработчик
        fireEvent.submit(container.querySelector('form')!)

        expect(await screen.findByText('Выбери направление практики')).toBeInTheDocument()
    })

    it('требует заполнить обязательное поле анкеты', async () => {
        seedCohort(FULL_COHORT)
        loginAsStudent()
        const { container } = render(<ApplyByInvitationPage />)

        await screen.findByText('Заявка на практику')
        fireEvent.click(screen.getByText('Backend'))
        fireEvent.submit(container.querySelector('form')!)

        expect(await screen.findByText('Заполни обязательное поле: «ФИО»')).toBeInTheDocument()
    })

    it('отправляет заявку с выбранным треком, ответами на все типы вопросов и показывает архив', async () => {
        seedCohort(FULL_COHORT)
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        await screen.findByText('Заявка на практику')

        fireEvent.click(screen.getByText('Frontend'))
        fireEvent.change(screen.getAllByPlaceholderText('Ваш ответ')[0], { target: { value: 'Иванов Иван' } })
        fireEvent.click(screen.getByRole('button', { name: '2' })) // select-переключатель "Курс"
        fireEvent.click(screen.getByRole('button', { name: 'Удалённо' })) // radio "Формат"
        fireEvent.click(screen.getByText('React')) // checkbox "Технологии"
        fireEvent.click(screen.getByText('Node'))

        fireEvent.click(screen.getByRole('button', { name: /Отправить заявку/ }))

        expect(await screen.findByText('Заявка отправлена!', {}, { timeout: 3000 })).toBeInTheDocument()

        const stored = JSON.parse(localStorage.getItem('mock_applications') ?? '[]')
        expect(stored).toHaveLength(1)
        expect(stored[0].track.title).toBe('Frontend')
        expect(stored[0].status).toBe('pending')
        const answersByLabel = Object.fromEntries(stored[0].answers.map((a: { label: string; value: string }) => [a.label, a.value]))
        expect(answersByLabel['ФИО']).toBe('Иванов Иван')
        expect(answersByLabel['Курс']).toBe('2')
        expect(answersByLabel['Формат']).toBe('Удалённо')
        expect(answersByLabel['Технологии']).toBe('React, Node')
    })

    it('не даёт подать заявку в закрытую когорту', async () => {
        seedCohort({ ...FULL_COHORT, status: 'closed' })
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Приём заявок в эту когорту закрыт')).toBeInTheDocument()
    })
})
