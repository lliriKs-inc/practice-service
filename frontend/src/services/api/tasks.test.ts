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
} from './tasks'

const APPLICATION_ID = 'app-1'

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
