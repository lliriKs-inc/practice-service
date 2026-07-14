import { beforeEach, describe, expect, it } from 'vitest'
import { saveToken, saveUser } from '@/lib/api/session'
import type { Application } from './invitation'
import {
    getMyWeekTasks,
    updateDailyTask,
    validateDailyTaskUpdate,
    DailyTaskValidationError,
    MAX_DESCRIPTION_LENGTH,
    MAX_LINKS_COUNT,
    getCohortWeekProgress,
    getMissedProgress,
    getMissedDaysCount,
} from './tasks'

const APPLICATION_ID = 'app-1'
const COHORT_ID = 'cohort-1'

function loginAsStudent() {
    saveToken('mock-jwt-student-1')
    saveUser({ id: 'student-1', email: 'student@urfu.ru', role: 'STUDENT', created_at: '2026-01-01' })
}

function seedApprovedApplication() {
    const app: Application = {
        id: APPLICATION_ID,
        status: 'approved',
        submitted_at: '2027-07-01T00:00:00.000Z',
        track: { id: 'track-1', title: 'Backend' },
        cohort: {
            id: 'cohort-1',
            title: 'Практика 2027',
            start_date: '2027-07-19T00:00:00.000Z', // Monday
            end_date: '2027-07-30T00:00:00.000Z', // Friday, two weeks later
        },
        student: { id: 'student-1', email: 'student@urfu.ru' },
        answers: [],
    }
    localStorage.setItem('mock_applications', JSON.stringify([app]))
}

describe('validateDailyTaskUpdate', () => {
    it('пропускает валидное обновление', () => {
        expect(() => validateDailyTaskUpdate({ description: 'Сделал X', links: [{ url: 'https://a.com' }] })).not.toThrow()
    })

    it('пропускает очистку дня (null + пустые ссылки)', () => {
        expect(() => validateDailyTaskUpdate({ description: null, links: [] })).not.toThrow()
    })

    it('отклоняет слишком длинное описание', () => {
        expect(() =>
            validateDailyTaskUpdate({ description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1), links: [] })
        ).toThrow(DailyTaskValidationError)
    })

    it('отклоняет больше 50 ссылок', () => {
        const links = Array.from({ length: MAX_LINKS_COUNT + 1 }, (_, i) => ({ url: `https://a.com/${i}` }))
        expect(() => validateDailyTaskUpdate({ description: null, links })).toThrow(DailyTaskValidationError)
    })

    it('отклоняет повторяющиеся ссылки', () => {
        expect(() =>
            validateDailyTaskUpdate({ description: null, links: [{ url: 'https://a.com' }, { url: 'https://a.com' }] })
        ).toThrow(DailyTaskValidationError)
    })

    it('отклоняет пустую ссылку', () => {
        expect(() => validateDailyTaskUpdate({ description: null, links: [{ url: '  ' }] })).toThrow(DailyTaskValidationError)
    })
})

describe('getMyWeekTasks / updateDailyTask (моки)', () => {
    beforeEach(() => {
        localStorage.clear()
        loginAsStudent()
        seedApprovedApplication()
    })

    it('возвращает только будние дни недели, ячейки существуют внутри границ практики', async () => {
        const week = await getMyWeekTasks(APPLICATION_ID, '2027-07-19')
        expect(week.weekStart).toBe('2027-07-19')
        expect(week.weekEnd).toBe('2027-07-23')
        expect(week.days).toHaveLength(5)
        expect(week.days.every(d => d.task !== null)).toBe(true)
    })

    it('ячейка вне границ практики отсутствует (task === null)', async () => {
        const week = await getMyWeekTasks(APPLICATION_ID, '2027-08-02')
        expect(week.days.every(d => d.task === null)).toBe(true)
    })

    it('сохраняет описание и ссылки в ячейку и они видны при повторной загрузке недели', async () => {
        const week = await getMyWeekTasks(APPLICATION_ID, '2027-07-19')
        const monday = week.days[0].task!

        await updateDailyTask(monday.id, {
            description: 'Настроил окружение',
            links: [{ url: 'https://github.com/example/repo' }],
        })

        const reloaded = await getMyWeekTasks(APPLICATION_ID, '2027-07-19')
        expect(reloaded.days[0].task?.description).toBe('Настроил окружение')
        expect(reloaded.days[0].task?.links).toHaveLength(1)
        expect(reloaded.days[0].task?.links[0].url).toBe('https://github.com/example/repo')
        expect(reloaded.days[0].task?.saved_at).not.toBeNull()
    })

    it('очистка дня сбрасывает описание и ссылки', async () => {
        const week = await getMyWeekTasks(APPLICATION_ID, '2027-07-19')
        const monday = week.days[0].task!
        await updateDailyTask(monday.id, { description: 'Что-то', links: [] })

        await updateDailyTask(monday.id, { description: null, links: [] })
        const reloaded = await getMyWeekTasks(APPLICATION_ID, '2027-07-19')
        expect(reloaded.days[0].task?.description).toBeNull()
        expect(reloaded.days[0].task?.links).toHaveLength(0)
    })

    it('отклоняет обновление невалидным телом ещё до похода в хранилище', async () => {
        await expect(
            updateDailyTask('any-id', { description: null, links: [{ url: 'https://a.com' }, { url: 'https://a.com' }] })
        ).rejects.toThrow(DailyTaskValidationError)
    })
})

describe('прогресс когорты (админ)', () => {
    const APP_2 = 'app-2'

    // Практика должна лежать в ПРОШЛОМ относительно реального "сегодня" теста —
    // иначе "пропущенный день" (task_date <= today) никогда не сработает.
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
    practiceEnd.setUTCDate(practiceEnd.getUTCDate() + 11) // захватывает 2 недели включительно

    function seedTwoApprovedApplications() {
        const apps: Application[] = [
            {
                id: APPLICATION_ID,
                status: 'approved',
                submitted_at: practiceStart.toISOString(),
                track: { id: 'track-1', title: 'Backend' },
                cohort: { id: COHORT_ID, title: 'Практика', start_date: practiceStart.toISOString(), end_date: practiceEnd.toISOString() },
                student: { id: 'student-1', email: 'anna@urfu.ru' },
                answers: [],
            },
            {
                id: APP_2,
                status: 'approved',
                submitted_at: practiceStart.toISOString(),
                track: { id: 'track-2', title: 'Frontend' },
                cohort: { id: COHORT_ID, title: 'Практика', start_date: practiceStart.toISOString(), end_date: practiceEnd.toISOString() },
                student: { id: 'student-2', email: 'boris@urfu.ru' },
                answers: [],
            },
        ]
        localStorage.setItem('mock_applications', JSON.stringify(apps))
    }

    beforeEach(() => {
        localStorage.clear()
        loginAsStudent()
        seedTwoApprovedApplications()
    })

    it('недельная сетка когорты включает обоих студентов', async () => {
        const weekStart = practiceStart.toISOString().split('T')[0]
        const progress = await getCohortWeekProgress(COHORT_ID, weekStart)
        expect(progress.students).toHaveLength(2)
        expect(progress.students.map(s => s.student.email).sort()).toEqual(['anna@urfu.ru', 'boris@urfu.ru'])
        expect(progress.days).toHaveLength(5)
    })

    it('незаполненный прошедший день попадает в missed', async () => {
        const weekStart = practiceStart.toISOString().split('T')[0]
        const week = await getMyWeekTasks(APPLICATION_ID, weekStart)
        expect(week.days[0].task?.description).toBeNull()

        const missed = await getMissedProgress(COHORT_ID, weekStart)
        expect(missed.missed.some(m => m.applicationId === APPLICATION_ID)).toBe(true)
    })

    it('missed можно отфильтровать по конкретному студенту', async () => {
        const weekStart = practiceStart.toISOString().split('T')[0]
        const missed = await getMissedProgress(COHORT_ID, weekStart, 'student-1')
        expect(missed.missed.every(m => m.student.id === 'student-1')).toBe(true)
    })

    it('заполненный день пропадает из missed после сохранения', async () => {
        const weekStart = practiceStart.toISOString().split('T')[0]
        const week = await getMyWeekTasks(APPLICATION_ID, weekStart)
        await updateDailyTask(week.days[0].task!.id, { description: 'Сделано', links: [] })

        const missed = await getMissedProgress(COHORT_ID, weekStart)
        expect(missed.missed.some(m => m.taskId === week.days[0].task!.id)).toBe(false)
    })

    it('getMissedDaysCount считает пропущенные дни по всей практике, не только по неделе', async () => {
        const weekStart = practiceStart.toISOString().split('T')[0]
        await getMyWeekTasks(APPLICATION_ID, weekStart) // досеивает календарь на весь период практики
        const count = await getMissedDaysCount(APPLICATION_ID)
        expect(count).toBeGreaterThan(0)
    })
})
