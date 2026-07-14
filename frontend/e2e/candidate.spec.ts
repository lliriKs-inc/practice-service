import { test, expect } from '@playwright/test'
import { uniqueEmail, registerViaUI, fillSurveyQuestion, expectNoSeriousA11yViolations } from './helpers'

// F-06: candidate E2E — регистрация → анкета по приглашению → заявка видна в ЛК.
// Работает на моковом домене cohorts/invitation/applications (см.
// BACKEND_GAP_COHORT_API.md) поверх реального auth. Инвайт "demo" на когорту
// "Практика 2026" (трек Backend/Frontend) создаётся автоматически при первом
// обращении к mock-хранилищу (services/api/cohorts.ts, MOCK_SEED).

test.describe('Кандидат: приглашение → анкета → заявка', () => {
    test('неавторизованный кандидат регистрируется и подаёт заявку по ссылке-приглашению', async ({ page }) => {
        const email = uniqueEmail('candidate')

        await page.goto('/apply/demo')

        await expect(page.getByRole('heading', { name: 'Приглашение на практику' })).toBeVisible()
        await expectNoSeriousA11yViolations(page)

        await page.getByText('Создать аккаунт').click()
        await expect(page).toHaveURL(/\/register/)

        await registerViaUI(page, { fullName: 'Кандидатов Кандидат Кандидатович', email, password: 'password123' })

        // После регистрации+логина должно вернуть обратно на анкету
        await expect(page).toHaveURL(/\/apply\/demo/, { timeout: 10000 })
        await expect(page.getByRole('heading', { name: 'Заявка на практику' })).toBeVisible()

        await page.getByRole('button', { name: 'Backend' }).click()
        await fillSurveyQuestion(page, 'ФИО', 'Кандидатов Кандидат Кандидатович')
        await fillSurveyQuestion(page, 'Группа', 'РИ-123456')
        await fillSurveyQuestion(page, 'Стек / инструменты', 'TypeScript, React, Node.js')

        await expectNoSeriousA11yViolations(page)

        await page.getByRole('button', { name: /Отправить заявку/ }).click()

        await expect(page.getByRole('heading', { name: 'Заявка отправлена!' })).toBeVisible({ timeout: 10000 })

        await page.getByRole('link', { name: /Перейти в личный кабинет/ }).click()
        await expect(page).toHaveURL(/\/dashboard\/applications/)
        await expect(page.getByRole('heading', { name: 'Backend' })).toBeVisible()
        await expect(page.getByText('На рассмотрении')).toBeVisible()
    })

    test('заявку нельзя подать дважды, пока по первой нет решения', async ({ page }) => {
        const email = uniqueEmail('candidate-dup')

        await page.goto('/apply/demo')
        await page.getByText('Создать аккаунт').click()
        await expect(page).toHaveURL(/\/register/)
        await registerViaUI(page, { fullName: 'Второй Кандидат', email, password: 'password123' })
        await expect(page).toHaveURL(/\/apply\/demo/, { timeout: 10000 })

        await page.getByRole('button', { name: 'Backend' }).click()
        await fillSurveyQuestion(page, 'ФИО', 'Второй Кандидат')
        await fillSurveyQuestion(page, 'Группа', 'РИ-1')
        await fillSurveyQuestion(page, 'Стек / инструменты', 'Go')
        await page.getByRole('button', { name: /Отправить заявку/ }).click()
        await expect(page.getByRole('heading', { name: 'Заявка отправлена!' })).toBeVisible({ timeout: 10000 })

        // Повторный заход по той же ссылке-приглашению
        await page.goto('/apply/demo')
        await expect(page.getByRole('heading', { name: 'У тебя уже есть активная заявка' })).toBeVisible()
    })
})
