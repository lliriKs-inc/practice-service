import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ApplicationTestTaskPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'

const APPLICATION_ID = 'app-1'

const mockUseParams = vi.fn()
vi.mock('next/navigation', () => ({
    useParams: () => mockUseParams(),
}))

// getMyApplication (invitation.ts) и getMyTestTask (test-task.ts) оба ходят
// через apiFetch — мокаем на этом уровне, чтобы client-side валидация файла
// (validateSubmissionFile внутри uploadSubmission) осталась настоящей и
// отрабатывала ДО похода в сеть, как в реальном коде.
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/api/http', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api/http')>('@/lib/api/http')
    return { ...actual, apiFetch }
})

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser({ id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01' })
}

function rawApplication(status = 'APPROVED') {
    return {
        id: APPLICATION_ID,
        status,
        submitted_at: '2027-07-05T00:00:00.000Z',
        rejection_reason: null,
        track: {
            id: 'track-1',
            title: 'Backend',
            cohort: { id: 'cohort-1', title: 'Практика 2027', practice_start: '2027-08-01', practice_end: '2027-08-31' },
        },
        answers: [],
    }
}

let currentSubmission: { id: string; file_name: string; submitted_at: string } | null = null

function setupTask(config: {
    publishedAt: string | null
    fileUrl?: string | null
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'
    submission?: { id: string; file_name: string; submitted_at: string } | null
}) {
    currentSubmission = config.submission ?? null
    apiFetch.mockImplementation(async (path: string) => {
        if (path === '/auth/me') return { id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01', active_application_id: null }
        if (path === `/me/applications/${APPLICATION_ID}`) return rawApplication(config.status)
        if (path === `/me/applications/${APPLICATION_ID}/test-task`) {
            if (!config.publishedAt) {
                return { available: false, message: 'Тестовое задание пока не опубликовано.' }
            }
            return {
                available: true,
                title: 'Разработка REST API',
                description: 'Описание задания',
                published_at: config.publishedAt,
                has_file: Boolean(config.fileUrl),
                download_path: config.fileUrl ?? null,
                submission: currentSubmission,
            }
        }
        throw new Error(`unexpected apiFetch call: ${path}`)
    })
}

const fetchMock = vi.fn()

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
        vi.clearAllMocks()

        fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
            const formData = init.body as FormData
            const file = formData.get('file') as File
            currentSubmission = { id: 'sub-1', file_name: file.name, submitted_at: new Date().toISOString() }
            return { ok: true, json: async () => currentSubmission }
        })
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('показывает сообщение, если задание ещё не опубликовано', async () => {
        setupTask({ publishedAt: null })
        render(<ApplicationTestTaskPage />)

        expect(await screen.findByText(/пока не опубликовано/, {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Загрузить решение/ })).not.toBeInTheDocument()
    })

    it('показывает "решение не загружено" и кнопку загрузки для опубликованного задания', async () => {
        setupTask({ publishedAt: '2027-07-10T00:00:00.000Z' })
        render(<ApplicationTestTaskPage />)

        expect(await screen.findByText('Разработка REST API', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByText('Решение ещё не загружено')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Загрузить решение/ })).toBeInTheDocument()
    })

    it('загружает решение и показывает имя файла + кнопку "Заменить"', async () => {
        setupTask({ publishedAt: '2027-07-10T00:00:00.000Z' })
        const { container } = render(<ApplicationTestTaskPage />)

        await screen.findByText('Решение ещё не загружено', {}, { timeout: 3000 })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        const file = makeFile('solution.pdf', 1024)
        fireEvent.change(input, { target: { files: [file] } })

        expect(await screen.findByText('solution.pdf', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Заменить решение/ })).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Тестовое задание: решение отправлено' })).toBeInTheDocument()
    })

    it('показывает завершённые шаги решения и одобрения', async () => {
        setupTask({
            publishedAt: '2027-07-10T00:00:00.000Z',
            status: 'APPROVED',
            submission: {
                id: 'sub-1',
                file_name: 'solution.pdf',
                submitted_at: '2027-07-11T00:00:00.000Z',
            },
        })

        render(<ApplicationTestTaskPage />)

        expect(await screen.findByRole('img', { name: 'Тестовое задание: решение отправлено' })).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Результат: заявка одобрена' })).toBeInTheDocument()
        expect(screen.getByText('Заявка одобрена')).toBeInTheDocument()
    })

    it('показывает крестик на шаге результата для отклонённой заявки', async () => {
        setupTask({
            publishedAt: '2027-07-10T00:00:00.000Z',
            status: 'REJECTED',
            submission: {
                id: 'sub-1',
                file_name: 'solution.pdf',
                submitted_at: '2027-07-11T00:00:00.000Z',
            },
        })

        render(<ApplicationTestTaskPage />)

        expect(await screen.findByRole('img', { name: 'Результат: заявка отклонена' })).toBeInTheDocument()
        expect(screen.getByText('Заявка отклонена')).toBeInTheDocument()
    })

    it('отклоняет файл неразрешённого формата с понятной ошибкой', async () => {
        setupTask({ publishedAt: '2027-07-10T00:00:00.000Z' })
        const { container } = render(<ApplicationTestTaskPage />)

        await screen.findByText('Решение ещё не загружено', {}, { timeout: 3000 })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        const file = makeFile('solution.exe', 1024, 'application/octet-stream')
        fireEvent.change(input, { target: { files: [file] } })

        expect(await screen.findByText(/Тип файла не поддерживается/, {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByText('Решение ещё не загружено')).toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('отклоняет файл больше лимита в 10 МБ', async () => {
        setupTask({ publishedAt: '2027-07-10T00:00:00.000Z' })
        const { container } = render(<ApplicationTestTaskPage />)

        await screen.findByText('Решение ещё не загружено', {}, { timeout: 3000 })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        const file = makeFile('solution.pdf', 11 * 1024 * 1024)
        fireEvent.change(input, { target: { files: [file] } })

        expect(await screen.findByText(/Размер файла превышает допустимый лимит/, {}, { timeout: 3000 })).toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('заменяет предыдущее решение новым файлом при повторной загрузке', async () => {
        setupTask({ publishedAt: '2027-07-10T00:00:00.000Z' })
        const { container } = render(<ApplicationTestTaskPage />)

        await screen.findByText('Решение ещё не загружено', {}, { timeout: 3000 })
        const input = container.querySelector('input[type="file"]') as HTMLInputElement

        fireEvent.change(input, { target: { files: [makeFile('first.pdf', 1024)] } })
        await screen.findByText('first.pdf', {}, { timeout: 3000 })

        fireEvent.change(input, { target: { files: [makeFile('second.zip', 2048)] } })
        await screen.findByText('second.zip', {}, { timeout: 3000 })

        expect(screen.queryByText('first.pdf')).not.toBeInTheDocument()
        expect(fetchMock).toHaveBeenCalledTimes(2)
    }, 10000)
})
