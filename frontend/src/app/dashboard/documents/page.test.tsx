import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import DashboardDocumentsPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Application } from '@/services/api/invitation'

const APPLICATION_ID = 'app-1'

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser({ id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01' })
}

// getByLabelText полагается на нативную ассоциацию label[for]/input.labels,
// которая в jsdom нестабильна для динамически смонтированных узлов — ищем
// поле напрямую через label -> соседний input/textarea в том же блоке.
function getFieldInput(container: HTMLElement, labelText: RegExp): HTMLInputElement | HTMLTextAreaElement {
    // selector: 'label' — иначе regex совпадает и с текстом "Не хватает: ...",
    // который временно содержит те же названия полей
    const label = within(container).getByText(labelText, { selector: 'label' })
    const field = label.parentElement!.querySelector('input, textarea')
    if (!field) throw new Error(`Не нашла поле рядом с лейблом ${labelText}`)
    return field as HTMLInputElement | HTMLTextAreaElement
}

function seedApplication(status: Application['status'] = 'approved') {
    const app: Application = {
        id: APPLICATION_ID,
        status,
        submitted_at: '2027-07-01T00:00:00.000Z',
        track: { id: 'track-1', title: 'Backend' },
        cohort: {
            id: 'cohort-1',
            title: 'Практика 2027',
            start_date: '2027-07-19T00:00:00.000Z',
            end_date: '2027-07-30T00:00:00.000Z',
        },
        student: { id: 'student-1', email: 'student@urfu.ru' },
        answers: [],
    }
    localStorage.setItem('mock_applications', JSON.stringify([app]))
}

describe('DashboardDocumentsPage', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsStudent()
    })

    it('показывает заглушку "недоступны", если нет одобренной заявки', async () => {
        seedApplication('pending')
        render(<DashboardDocumentsPage />)

        expect(await screen.findByText('Документы пока недоступны', {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('показывает карточки всех 4 типов документов и раздел отчёта для одобренной заявки', async () => {
        seedApplication('approved')
        render(<DashboardDocumentsPage />)

        expect(await screen.findByText('Индивидуальное задание', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByText('Титульный лист отчёта')).toBeInTheDocument()
        expect(screen.getByText('Отзыв руководителя практики')).toBeInTheDocument()
        expect(screen.getByText('Направление на практику')).toBeInTheDocument()
        expect(screen.getByText('Отчёт ещё не загружен')).toBeInTheDocument()
        expect(screen.getByText('Заполняется куратором практики — доступно только для просмотра.')).toBeInTheDocument()
    })

    it('сохраняет поле по blur и разблокирует кнопку "Сформировать" после заполнения всех полей NOTICE', async () => {
        seedApplication('approved')
        render(<DashboardDocumentsPage />)

        await screen.findByText('Направление на практику', {}, { timeout: 3000 })
        const noticeCard = screen.getByText('Направление на практику').closest('div.bg-white') as HTMLElement

        const fioInput = getFieldInput(noticeCard, /ФИО студента/)
        fireEvent.change(fioInput, { target: { value: 'Иванов Иван' } })
        fireEvent.blur(fioInput)
        await waitFor(() => expect(screen.queryByText('сохраняем…')).not.toBeInTheDocument(), { timeout: 3000 })

        const groupInput = getFieldInput(noticeCard, /Группа/)
        fireEvent.change(groupInput, { target: { value: 'РИ-123' } })
        fireEvent.blur(groupInput)
        await waitFor(() => expect(screen.queryByText('сохраняем…')).not.toBeInTheDocument(), { timeout: 3000 })

        const topicInput = getFieldInput(noticeCard, /Тема практики/)
        fireEvent.change(topicInput, { target: { value: 'Тема практики' } })
        fireEvent.blur(topicInput)

        await waitFor(() => {
            expect(within(noticeCard).getByText('✅ Готов к формированию')).toBeInTheDocument()
        }, { timeout: 3000 })

        const generateButton = within(noticeCard).getByRole('button', { name: /Сформировать/ })
        expect(generateButton).not.toBeDisabled()
    })

    it('показывает готовность документа НЕготовым, если требуется одобренный отчёт (TITLE_PAGE)', async () => {
        seedApplication('approved')
        render(<DashboardDocumentsPage />)

        await screen.findByText('Титульный лист отчёта', {}, { timeout: 3000 })
        const card = screen.getByText('Титульный лист отчёта').closest('div.bg-white') as HTMLElement

        for (const [label, value] of [
            [/ФИО студента/, 'Иванов Иван'],
            [/Группа/, 'РИ-123'],
            [/Специальность/, 'ПИ'],
            [/Тема практики/, 'Тема практики'],
        ] as const) {
            const input = getFieldInput(card, label)
            fireEvent.change(input, { target: { value } })
            fireEvent.blur(input)
            await waitFor(() => expect(screen.queryByText('сохраняем…')).not.toBeInTheDocument(), { timeout: 3000 })
        }

        expect(await within(card).findByText(/одобрен куратором/, {}, { timeout: 3000 })).toBeInTheDocument()
        expect(within(card).getByRole('button', { name: /Сформировать/ })).toBeDisabled()
    }, 15000)
})
