import { describe, expect, it } from 'vitest'
import { ApiError } from './http'
import { describeApiError } from './error-messages'

describe('describeApiError', () => {
    it('переводит ошибку неверных учётных данных', () => {
        const error = new ApiError('Invalid credentials', 401, {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials',
        })

        expect(describeApiError(error, 'Ошибка входа')).toBe(
            'Неверный e-mail или пароль.'
        )
    })
})
