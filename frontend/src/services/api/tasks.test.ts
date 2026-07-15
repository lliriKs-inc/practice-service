import { describe, expect, it } from 'vitest'
import { validateDailyTaskUpdate, DailyTaskValidationError, MAX_DESCRIPTION_LENGTH, MAX_LINKS_COUNT } from './tasks'

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
