import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DashboardTasksPage from './page'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Application } from '@/services/api/invitation'
import { validateDailyTaskUpdate, type DailyTask, type DailyTaskLink, type StudentWeekResponse, type UpdateDailyTaskDto } from '@/services/api/tasks'

const APPLICATION_ID = 'app-1'

const { getMyApplications } = vi.hoisted(() => ({ getMyApplications: vi.fn() }))
vi.mock('@/services/api/invitation', () => ({ getMyApplications }))

const { getMyWeekTasks, updateDailyTask } = vi.hoisted(() => ({
    getMyWeekTasks: vi.fn(),
    updateDailyTask: vi.fn(),
}))

vi.mock('@/services/api/tasks', async () => {
    const actual = await vi.importActual<typeof import('@/services/api/tasks')>('@/services/api/tasks')
    return { ...actual, getMyWeekTasks, updateDailyTask }
})

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser({ id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01' })
}

function makeApplication(
    status: Application['status'] = 'approved',
    cohortDates: { start_date: string; end_date: string } = {
        start_date: '2027-07-19T00:00:00.000Z', // Monday
        end_date: '2027-07-30T00:00:00.000Z',
    }
): Application {
    return {
        id: APPLICATION_ID,
        status,
        submitted_at: '2027-07-01T00:00:00.000Z',
        track: { id: 'track-1', title: 'Backend' },
        cohort: { id: 'cohort-1', title: 'Практика 2027', start_date: cohortDates.start_date, end_date: cohortDates.end_date },
        student: { id: 'student-1', email: 'student@urfu.ru' },
        answers: [],
    }
}

// ── In-memory дневник задач для этого теста (заменяет удалённый мок из tasks.ts) ──
let taskStore: Record<string, { description: string | null; links: DailyTaskLink[] }>
let practiceStart: string
let practiceEnd: string

function resetTaskStore(startIso: string, endIso: string) {
    taskStore = {}
    practiceStart = startIso
    practiceEnd = endIso
}

function weekdayDates(weekStartIso: string): string[] {
    const monday = new Date(weekStartIso)
    return Array.from({ length: 5 }, (_, i) => {
        const d = new Date(monday)
        d.setUTCDate(d.getUTCDate() + i)
        return d.toISOString().split('T')[0]
    })
}

function withinPractice(dateStr: string): boolean {
    return dateStr >= practiceStart.split('T')[0] && dateStr <= practiceEnd.split('T')[0]
}

function buildWeek(weekStart: string): StudentWeekResponse {
    const days = weekdayDates(weekStart)
    const weekEnd = days[days.length - 1]
    return {
        applicationId: APPLICATION_ID,
        cohort: { id: 'cohort-1', title: 'Практика 2027', practice_start: practiceStart, practice_end: practiceEnd },
        track: { id: 'track-1', title: 'Backend' },
        weekStart,
        weekEnd,
        days: days.map(date => {
            if (!withinPractice(date)) return { date, task: null }
            const entry = taskStore[date] ?? { description: null, links: [] }
            const task: DailyTask = {
                id: `task-${date}`,
                application_id: APPLICATION_ID,
                task_date: date,
                description: entry.description,
                saved_at: entry.description !== null ? new Date().toISOString() : null,
                links: entry.links,
            }
            return { date, task }
        }),
    }
}

function setupTasksMocks() {
    getMyWeekTasks.mockImplementation(async (_appId: string, weekStart: string) => buildWeek(weekStart))
    updateDailyTask.mockImplementation(async (taskId: string, dto: UpdateDailyTaskDto) => {
        validateDailyTaskUpdate(dto)
        const date = taskId.replace('task-', '')
        taskStore[date] = { description: dto.description, links: dto.links.map((l, i) => ({ id: `link-${i}`, daily_task_id: taskId, url: l.url })) }
        return {
            id: taskId,
            application_id: APPLICATION_ID,
            task_date: date,
            description: dto.description,
            saved_at: new Date().toISOString(),
            links: taskStore[date].links,
        }
    })
}

describe('DashboardTasksPage (дневник задач)', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsStudent()
        vi.clearAllMocks()
        resetTaskStore('2027-07-19T00:00:00.000Z', '2027-07-30T00:00:00.000Z')
        setupTasksMocks()
    })

    it('показывает заглушку "недоступен", если нет одобренной заявки', async () => {
        getMyApplications.mockResolvedValue([makeApplication('pending')])
        render(<DashboardTasksPage />)

        expect(await screen.findByText('Дневник задач пока недоступен', {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('[FIX] если практика начинается в выходной, сразу открывает первую РАБОЧУЮ неделю, а не пустую неделю до начала', async () => {
        // Практика начинается в субботу — Monday-of-week(суббота) попадает на предыдущую
        // неделю целиком до начала практики (нашёл пользователь при ручной проверке).
        resetTaskStore('2026-08-01T00:00:00.000Z', '2026-08-31T00:00:00.000Z') // Saturday
        getMyApplications.mockResolvedValue([makeApplication('approved', { start_date: '2026-08-01T00:00:00.000Z', end_date: '2026-08-31T00:00:00.000Z' })])
        render(<DashboardTasksPage />)

        expect(await screen.findByText(/3–7 авг/, {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.queryByText(/27–31 июл/)).not.toBeInTheDocument()
        // "Пред." должна быть заблокирована — раньше первой рабочей недели практики уходить некуда
        expect(screen.getByRole('button', { name: '← Пред.' })).toBeDisabled()
    })

    it('показывает недельную сетку из 5 будних дней для одобренной заявки', async () => {
        getMyApplications.mockResolvedValue([makeApplication('approved')])
        render(<DashboardTasksPage />)

        expect(await screen.findByText(/19–23 июл/, {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getAllByText('+ Заполнить день')).toHaveLength(5)
    })

    it('заполняет день описанием и ссылкой, значения сохраняются и отображаются', async () => {
        getMyApplications.mockResolvedValue([makeApplication('approved')])
        render(<DashboardTasksPage />)

        const cells = await screen.findAllByText('+ Заполнить день', {}, { timeout: 3000 })
        fireEvent.click(cells[0])

        const dialog = await screen.findByText('Что делал сегодня?')
        const textarea = dialog.parentElement!.querySelector('textarea') as HTMLTextAreaElement
        fireEvent.change(textarea, { target: { value: 'Настроил окружение' } })

        fireEvent.click(screen.getByText('+ Добавить ссылку'))
        const linkInput = screen.getByPlaceholderText('GitHub, Figma, Google Drive…')
        fireEvent.change(linkInput, { target: { value: 'https://github.com/example/repo' } })

        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

        // Ждём закрытия попапа (иначе описание совпадает с текстом внутри его собственной textarea)
        await waitFor(() => expect(screen.queryByText('Что делал сегодня?')).not.toBeInTheDocument(), { timeout: 3000 })

        expect(await screen.findByText('Настроил окружение', {}, { timeout: 3000 })).toBeInTheDocument()
        expect(screen.getByText(/🔗 Ссылка/)).toBeInTheDocument()

        const monday = taskStore['2027-07-19']
        expect(monday.description).toBe('Настроил окружение')
        expect(monday.links).toHaveLength(1)
    })

    it('показывает ошибку валидации при повторяющихся ссылках', async () => {
        getMyApplications.mockResolvedValue([makeApplication('approved')])
        render(<DashboardTasksPage />)

        const cells = await screen.findAllByText('+ Заполнить день', {}, { timeout: 3000 })
        fireEvent.click(cells[0])

        fireEvent.click(screen.getByText('+ Добавить ссылку'))
        fireEvent.click(screen.getByText('+ Добавить ссылку'))
        const linkInputs = screen.getAllByPlaceholderText('GitHub, Figma, Google Drive…')
        fireEvent.change(linkInputs[0], { target: { value: 'https://a.com' } })
        fireEvent.change(linkInputs[1], { target: { value: 'https://a.com' } })

        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

        expect(await screen.findByText(/не должны повторяться/, {}, { timeout: 3000 })).toBeInTheDocument()
    })

    it('очищает день кнопкой "Очистить день"', async () => {
        getMyApplications.mockResolvedValue([makeApplication('approved')])
        render(<DashboardTasksPage />)

        const cells = await screen.findAllByText('+ Заполнить день', {}, { timeout: 3000 })
        fireEvent.click(cells[0])
        const textarea = screen.getByPlaceholderText('Опиши выполненную работу…')
        fireEvent.change(textarea, { target: { value: 'Черновик' } })
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
        await waitFor(() => expect(screen.queryByText('Что делал сегодня?')).not.toBeInTheDocument(), { timeout: 3000 })
        await screen.findByText('Черновик', {}, { timeout: 3000 })

        fireEvent.click(screen.getByText('Черновик'))
        fireEvent.click(await screen.findByRole('button', { name: 'Очистить день' }))
        await waitFor(() => expect(screen.queryByText('Что делал сегодня?')).not.toBeInTheDocument(), { timeout: 3000 })
        await waitFor(() => expect(screen.getAllByText('+ Заполнить день')).toHaveLength(5), { timeout: 3000 })
    }, 10000)
})
