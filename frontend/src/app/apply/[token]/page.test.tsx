import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ApplyByInvitationPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import type { InvitationForm } from '@/services/api/invitation'

const mockUseParams = vi.fn()
vi.mock('next/navigation', () => ({
    useParams: () => mockUseParams(),
}))

const { getInvitationForm, submitApplication } = vi.hoisted(() => ({
    getInvitationForm: vi.fn(),
    submitApplication: vi.fn(),
}))

vi.mock('@/services/api/invitation', () => ({ getInvitationForm, submitApplication }))

const TOKEN = 'test-token'

// Анкета с вопросами всех типов — покрывает text/textarea/select/radio/checkbox
const FULL_FORM: InvitationForm = {
    cohort: { id: 'cohort-1', title: 'Практика 2027' },
    tracks: [
        { id: 'track-backend', title: 'Backend' },
        { id: 'track-frontend', title: 'Frontend' },
    ],
    questions: [
        { id: 'q-text', label: 'ФИО', type: 'text', required: true, options: [], order_index: 1 },
        { id: 'q-textarea', label: 'О себе', type: 'textarea', required: false, options: [], order_index: 2 },
        { id: 'q-select', label: 'Курс', type: 'select', required: false, options: ['1', '2', '3'], order_index: 3 },
        { id: 'q-radio', label: 'Формат', type: 'radio', required: false, options: ['Очно', 'Удалённо'], order_index: 4 },
        { id: 'q-checkbox', label: 'Технологии', type: 'checkbox', required: false, options: ['React', 'Node'], order_index: 5 },
    ],
}

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser({ id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01' })
}

function loginAsAdmin() {
    saveToken('mock-jwt-admin-1')
    saveUser({ id: 'admin-1', email: 'admin@urfu.ru', role: 'ADMIN', created_at: '2026-01-01' })
}

describe('ApplyByInvitationPage', () => {
    beforeEach(() => {
        localStorage.clear()
        mockUseParams.mockReturnValue({ token: TOKEN })
        vi.clearAllMocks()
        getInvitationForm.mockResolvedValue(FULL_FORM)
        submitApplication.mockResolvedValue({ id: 'new-app', status: 'pending' })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('показывает "Ссылка недействительна" для несуществующего токена', async () => {
        getInvitationForm.mockRejectedValue(new Error('Ссылка недействительна'))
        render(<ApplyByInvitationPage />)

        expect(await screen.findByRole('heading', { name: 'Ссылка недействительна' })).toBeInTheDocument()
    })

    it('предлагает войти/зарегистрироваться, если пользователь не авторизован', async () => {
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Приглашение на практику')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Войти →' })).toBeInTheDocument()
        expect(screen.getByText('Создать аккаунт')).toBeInTheDocument()
    })

    it('не даёт админу заполнить анкету по ссылке-приглашению', async () => {
        loginAsAdmin()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Ссылка не для организаторов')).toBeInTheDocument()
        expect(screen.queryByText('Заявка на практику')).not.toBeInTheDocument()
    })

    it('разрешает подать ещё одну заявку студенту', async () => {
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Заявка на практику')).toBeInTheDocument()
    })

    it('рендерит все типы вопросов анкеты и оба трека', async () => {
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Заявка на практику')).toBeInTheDocument()
        expect(screen.getByText('Backend')).toBeInTheDocument()
        expect(screen.getByText('Frontend')).toBeInTheDocument()

        // text
        expect(screen.getAllByPlaceholderText('Ваш ответ').length).toBeGreaterThan(0)
        // select — настоящий выпадающий список
        expect(screen.getByRole('combobox')).toBeInTheDocument()
        expect(screen.getByRole('option', { name: '1' })).toBeInTheDocument()
        // radio отрисован как переключатели-кнопки с вариантами
        expect(screen.getByRole('button', { name: 'Очно' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Удалённо' })).toBeInTheDocument()
        // checkbox
        expect(screen.getByText('React')).toBeInTheDocument()
        expect(screen.getByText('Node')).toBeInTheDocument()
    })

    it('требует выбрать трек перед отправкой', async () => {
        loginAsStudent()
        const { container } = render(<ApplyByInvitationPage />)

        await screen.findByText('Заявка на практику')
        // Сабмитим форму напрямую — клик по кнопке уходит в нативную HTML5-валидацию
        // required-полей раньше, чем до неё доберётся наш собственный обработчик
        fireEvent.submit(container.querySelector('form')!)

        expect(await screen.findByText('Выбери направление практики')).toBeInTheDocument()
    })

    it('требует заполнить обязательное поле анкеты', async () => {
        loginAsStudent()
        const { container } = render(<ApplyByInvitationPage />)

        await screen.findByText('Заявка на практику')
        fireEvent.click(screen.getByText('Backend'))
        fireEvent.submit(container.querySelector('form')!)

        expect(await screen.findByText('Заполни обязательное поле: «ФИО»')).toBeInTheDocument()
    })

    it('отправляет заявку с выбранным треком, ответами на все типы вопросов и показывает подтверждение', async () => {
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        await screen.findByText('Заявка на практику')

        fireEvent.click(screen.getByText('Frontend'))
        fireEvent.change(screen.getAllByPlaceholderText('Ваш ответ')[0], { target: { value: 'Иванов Иван' } })
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } }) // select "Курс"
        fireEvent.click(screen.getByRole('button', { name: 'Удалённо' })) // radio "Формат"
        fireEvent.click(screen.getByText('React')) // checkbox "Технологии"
        fireEvent.click(screen.getByText('Node'))

        fireEvent.click(screen.getByRole('button', { name: /Отправить заявку/ }))

        expect(await screen.findByText('Заявка отправлена!', {}, { timeout: 3000 })).toBeInTheDocument()

        expect(submitApplication).toHaveBeenCalledTimes(1)
        const [calledToken, calledTrackId, calledAnswers] = submitApplication.mock.calls[0]
        expect(calledToken).toBe(TOKEN)
        expect(calledTrackId).toBe('track-frontend')
        const answersByQuestionId = Object.fromEntries(
            (calledAnswers as { question_id: string; answer_value: string }[]).map(a => [a.question_id, a.answer_value])
        )
        expect(answersByQuestionId['q-text']).toBe('Иванов Иван')
        expect(answersByQuestionId['q-select']).toBe('2')
        expect(answersByQuestionId['q-radio']).toBe('Удалённо')
        expect(answersByQuestionId['q-checkbox']).toBe('React, Node')
    })

    it('не даёт подать заявку в закрытую когорту (backend отклоняет окно приёма заявок)', async () => {
        getInvitationForm.mockRejectedValue(new Error('Приём заявок в эту когорту сейчас закрыт'))
        loginAsStudent()
        render(<ApplyByInvitationPage />)

        expect(await screen.findByText('Приём заявок в эту когорту сейчас закрыт')).toBeInTheDocument()
    })
})
