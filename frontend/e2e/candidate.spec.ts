import { test, expect } from '@playwright/test'
import { uniqueEmail, registerViaUI, fillSurveyQuestion, expectNoSeriousA11yViolations, seedInvitedCohort } from './helpers'

// Реальный cutover: каждая заявка тестов сама заводит когорту/трек/анкету/
// инвайт-токен через admin-API (см. helpers.ts:seedInvitedCohort) — мокового
// /apply/demo больше нет, cohorts.ts теперь бьёт по настоящему backend.

test.describe('Кандидат: приглашение → анкета → заявка', () => {
    test('неавторизованный кандидат регистрируется и подаёт заявку по ссылке-приглашению', async ({ page }) => {
        const email = uniqueEmail('candidate')
        const { token } = await seedInvitedCohort()

        await page.goto(`/apply/${token}`)

        await expect(page.getByRole('heading', { name: 'Приглашение на практику' })).toBeVisible()
        await expectNoSeriousA11yViolations(page)

        await page.getByText('Создать аккаунт').click()
        await expect(page).toHaveURL(/\/register/)

        await registerViaUI(page, { fullName: 'Кандидатов Кандидат Кандидатович', email, password: 'password123' })

        // После регистрации+логина должно вернуть обратно на анкету
        await expect(page).toHaveURL(new RegExp(`/apply/${token}`), { timeout: 10000 })
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

    // Правило "одна активная заявка блокирует новую" убрано продуктом —
    // студент может подавать заявки на разные треки/когорты параллельно.
    // Единственное реальное ограничение осталось на уровне БД: нельзя подать
    // вторую заявку на ТОТ ЖЕ трек (уникальность user_id+track_id, код
    // APPLICATION_ALREADY_EXISTS) — именно это и проверяем.
    test('нельзя подать вторую заявку на тот же трек', async ({ page }) => {
        const email = uniqueEmail('candidate-dup')
        const { token } = await seedInvitedCohort()

        await page.goto(`/apply/${token}`)
        await page.getByText('Создать аккаунт').click()
        await expect(page).toHaveURL(/\/register/)
        await registerViaUI(page, { fullName: 'Второй Кандидат', email, password: 'password123' })
        await expect(page).toHaveURL(new RegExp(`/apply/${token}`), { timeout: 10000 })

        await page.getByRole('button', { name: 'Backend' }).click()
        await fillSurveyQuestion(page, 'ФИО', 'Второй Кандидат')
        await fillSurveyQuestion(page, 'Группа', 'РИ-1')
        await fillSurveyQuestion(page, 'Стек / инструменты', 'Go')
        await page.getByRole('button', { name: /Отправить заявку/ }).click()
        await expect(page.getByRole('heading', { name: 'Заявка отправлена!' })).toBeVisible({ timeout: 10000 })

        // Повторный заход по той же ссылке-приглашению — анкета открывается
        // снова (блокировки на уровне страницы больше нет), но повторная
        // отправка на тот же трек должна упасть с понятной ошибкой.
        await page.goto(`/apply/${token}`)
        await expect(page.getByRole('heading', { name: 'Заявка на практику' })).toBeVisible({ timeout: 10000 })

        await page.getByRole('button', { name: 'Backend' }).click()
        await fillSurveyQuestion(page, 'ФИО', 'Второй Кандидат')
        await fillSurveyQuestion(page, 'Группа', 'РИ-1')
        await fillSurveyQuestion(page, 'Стек / инструменты', 'Go')
        await page.getByRole('button', { name: /Отправить заявку/ }).click()
        await expect(page.getByText('Заявка на этот трек уже была подана.')).toBeVisible({ timeout: 10000 })
    })
})
