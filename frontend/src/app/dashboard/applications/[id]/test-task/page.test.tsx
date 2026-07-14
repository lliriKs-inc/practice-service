import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ApplicationTestTaskPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Cohort } from '@/services/api/cohorts'
import type { Application } from '@/services/api/invitation'

const APPLICATION_ID = 'app-1'

const mockUseParams = vi.fn()
vi.mock('next/navigation', () => ({
    useParams: () => mockUseParams(),
}))

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser({ id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01' })
}

function seedCohort(overrides: { publishedAt: string | null; fileUrl?: string | null }) {
    const cohort: Cohort = {
        id: 'cohort-1',
        title: 'Практика 2027',
        status: 'active',
        start_date: '2027-08-01',
        end_date: '2027-08-31',
        created_at: '2027-07-01T00:00:00.000Z',
        tracks: [{
            id: 'track-1',
            title: 'Backend',
            testTask: {
                title: 'Разработка REST API',
                description: 'Описание задания',
                fileUrl: overrides.fileUrl ?? null,
                publishedAt: overrides.publishedAt,
            },
        }],
        survey: null,
        invitation: null,
    }
    localStorage.setItem('mock_cohorts', JSON.stringify([cohort]))
}

function seedApplication() {
    const app: Application = {
        id: APPLICATION_ID,
        status: 'approved',
        submitted_at: '2027-07-05T00:00:00.000Z',
        track: { id: 'track-1', title: 'Backend' },
        cohort: { id: 'cohort-1', title: 'Практика 2027', start_date: '2027-08-01', end_date: '2027-08-31' },
        student: { id: 'student-1', email: 'student@urfu.ru' },
        answers: [],
    }
    localStorage.setItem('mock_applications', JSON.stringify([app]))
}

function makeFile(name: string, sizeBytes: number, type = 'application/pdf'): File {
    const file = new File(['x'.repeat(Math.min(sizeBytes, 1024))], name, { type })
    Object.defineProperty(file, 'size', { value: sizeBytes })
    return file
}

describe('ApplicationTestTaskPage (просмотр задания + загрузка решения)', () => {
    beforeEach(() => {
        localStorage.clear()
        mockUseParams.mockReturnValue({ id: APPLICATION_ID })
        loginAsStudent()
        seedApplication()
    })

    it('показывает сообщение, если задание ещё не опубликовано', async () => {
        seedCohort({ publishedAt: null })
        render(<ApplicationTestTaskPage />)

        expect(await screen.findByText(/пока не опубликовано/, {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Загрузить решение/ })).not.toBeInTheDocument()
    })

    it('показывает "решение не загружено" и кнопку загрузки для опубликованного задания', async () => {
        seedCohort({ publishedAt: '2027-07-10T00:00:00.000Z' })
        render(<ApplicationTestTaskPage />)

        expect(await screen.findByText('Разработка REST API', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByText('Решение ещё не загружено')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Загрузить решение/ })).toBeInTheDocument()
    })

    it('загружает решение и показывает имя файла + кнопку "Заменить"', async () => {
        seedCohort({ publishedAt: '2027-07-10T00:00:00.000Z' })
        const { container } = render(<ApplicationTestTaskPage />)

        await screen.findByText('Решение ещё не загружено', {}, { timeout: 3000 })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        const file = makeFile('solution.pdf', 1024)
        fireEvent.change(input, { target: { files: [file] } })

        expect(await screen.findByText('solution.pdf', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Заменить решение/ })).toBeInTheDocument()
    })

    it('отклоняет файл неразрешённого формата с понятной ошибкой', async () => {
        seedCohort({ publishedAt: '2027-07-10T00:00:00.000Z' })
        const { container } = render(<ApplicationTestTaskPage />)

        await screen.findByText('Решение ещё не загружено', {}, { timeout: 3000 })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        const file = makeFile('solution.exe', 1024, 'application/octet-stream')
        fireEvent.change(input, { target: { files: [file] } })

        expect(await screen.findByText(/Тип файла не поддерживается/, {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByText('Решение ещё не загружено')).toBeInTheDocument()
    })

    it('отклоняет файл больше лимита в 10 МБ', async () => {
        seedCohort({ publishedAt: '2027-07-10T00:00:00.000Z' })
        const { container } = render(<ApplicationTestTaskPage />)

        await screen.findByText('Решение ещё не загружено', {}, { timeout: 3000 })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        const file = makeFile('solution.pdf', 11 * 1024 * 1024)
        fireEvent.change(input, { target: { files: [file] } })

        expect(await screen.findByText(/Размер файла превышает допустимый лимит/, {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('заменяет предыдущее решение новым файлом при повторной загрузке', async () => {
        seedCohort({ publishedAt: '2027-07-10T00:00:00.000Z' })
        const { container } = render(<ApplicationTestTaskPage />)

        await screen.findByText('Решение ещё не загружено', {}, { timeout: 3000 })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement

        fireEvent.change(input, { target: { files: [makeFile('first.pdf', 1024)] } })
        await screen.findByText('first.pdf', {}, { timeout: 3000 })

        fireEvent.change(input, { target: { files: [makeFile('second.zip', 2048)] } })
        await screen.findByText('second.zip', {}, { timeout: 3000 })

        expect(screen.queryByText('first.pdf')).not.toBeInTheDocument()

        const stored = JSON.parse(localStorage.getItem('mock_test_task_submissions') ?? '[]')
        expect(stored).toHaveLength(1)
        expect(stored[0].fileName).toBe('second.zip')
    }, 10000)
})
