import { test, expect } from '@playwright/test'
import { uniqueEmail, registerViaUI, loginViaUI, logoutViaUI, fillSurveyQuestion, expectNoSeriousA11yViolations, seedInvitedCohort } from './helpers'

// Реальный cutover: когорта/трек/анкета/тестовое задание/инвайт заводятся
// через admin-API (helpers.ts:seedInvitedCohort) перед тестом — весь
// остальной путь (регистрация, одобрение, тестовое задание, дневник,
// документы) идёт через настоящий backend.

const ADMIN_EMAIL = 'admin@academy.com'
const ADMIN_PASSWORD = 'password123'

test.describe('Практика: одобрение → тестовое задание → дневник → документы', () => {
    test('полный путь одобренного практиканта', async ({ page }) => {
        const email = uniqueEmail('practice')
        const fullName = 'Практикантов Практикант Практикантович'
        const { token, cohortId } = await seedInvitedCohort()

        await test.step('кандидат подаёт заявку', async () => {
            await page.goto(`/apply/${token}`)
            await page.getByText('Создать аккаунт').click()
            await expect(page).toHaveURL(/\/register/)
            await registerViaUI(page, { fullName, email, password: 'password123' })
            await expect(page).toHaveURL(new RegExp(`/apply/${token}`), { timeout: 10000 })

            await page.getByRole('button', { name: 'Backend' }).click()
            await fillSurveyQuestion(page, 'ФИО', fullName)
            await fillSurveyQuestion(page, 'Группа', 'РИ-1')
            await fillSurveyQuestion(page, 'Стек / инструменты', 'Node.js')
            await page.getByRole('button', { name: /Отправить заявку/ }).click()
            await expect(page.getByRole('heading', { name: 'Заявка отправлена!' })).toBeVisible({ timeout: 10000 })
        })

        await test.step('админ одобряет заявку', async () => {
            await logoutViaUI(page)
            await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD)
            await expect(page).toHaveURL(/\/admin\/cohorts/, { timeout: 10000 })

            await page.goto('/admin/applications')
            // Новая когорта не обязательно выбрана в CohortSwitcher по умолчанию —
            // переключаемся на ту, что создали для этого теста.
            await page.getByLabel('Выбор рабочей когорты').selectOption(cohortId)
            const approveButton = page.getByRole('button', { name: 'Одобрить' }).first()
            await approveButton.waitFor({ state: 'visible' })
            await expectNoSeriousA11yViolations(page)
            // На узких вьюпортах сразу после рендера возможен короткий layout
            // shift (карточка фильтров) — даём вёрстке устояться перед кликом.
            await page.waitForTimeout(300)
            await approveButton.scrollIntoViewIfNeeded()
            await approveButton.click({ timeout: 15000 })
            // Одобрение теперь требует подтверждения в модалке.
            await expect(page.getByRole('heading', { name: 'Одобрить заявку?' })).toBeVisible({ timeout: 5000 })
            await page.getByRole('button', { name: 'Подтвердить' }).click()
            // "Одобрена" встречается и как <option> в фильтре — берём именно бейдж статуса
            await expect(page.locator('span.text-xs.font-semibold', { hasText: 'Одобрена' }).first())
                .toBeVisible({ timeout: 10000 })
        })

        await test.step('практикант загружает решение тестового задания', async () => {
            await logoutViaUI(page)
            await loginViaUI(page, email, 'password123')
            await expect(page).toHaveURL(/\/dashboard\/applications/, { timeout: 10000 })

            await page.getByRole('link', { name: /Тестовое задание/ }).click()
            await expect(page).toHaveURL(/test-task/, { timeout: 10000 })
            await expect(page.getByRole('heading', { name: 'Разработка REST API' })).toBeVisible({ timeout: 10000 })

            await expectNoSeriousA11yViolations(page)

            const fileInput = page.locator('input[type="file"]')
            await fileInput.setInputFiles({
                name: 'solution.pdf',
                mimeType: 'application/pdf',
                buffer: Buffer.from('%PDF-1.4 e2e fixture'),
            })
            // Backend не хранит оригинальное имя файла (TestTaskSubmission
            // в схеме — только file_url + submitted_at), поэтому UI показывает
            // общий лейбл "Файл решения", а не имя загруженного файла.
            await expect(page.getByText('Файл решения')).toBeVisible({ timeout: 10000 })
            await expect(page.getByRole('button', { name: /Заменить решение/ })).toBeVisible()
        })

        await test.step('практикант заполняет дневник задач', async () => {
            await page.goto('/dashboard/tasks')
            const emptyDay = page.getByText('+ Заполнить день').first()
            await emptyDay.click()
            await page.getByPlaceholder('Опиши выполненную работу…').fill('Настроил окружение и прочитал документацию')
            await page.getByRole('button', { name: 'Сохранить' }).click()
            await expect(page.getByText('Настроил окружение и прочитал документацию')).toBeVisible({ timeout: 10000 })
        })

        await test.step('практикант заполняет документ "Извещение о прохождении практики"', async () => {
            await page.goto('/dashboard/documents')
            await expectNoSeriousA11yViolations(page)

            const noticeHeading = page.getByText('Извещение о прохождении практики')
            const card = noticeHeading.locator('xpath=ancestor::div[contains(@class, "bg-white")][1]')

            async function fillField(label: string, value: string) {
                const fieldLabel = card.getByText(label, { exact: true })
                const input = fieldLabel.locator('..').locator('input, textarea')
                await input.fill(value)
                await input.blur()
            }

            await fillField('ФИО студента', fullName)
            await fillField('Группа', 'РИ-1')
            await fillField('Тема практики', 'Backend на Node.js')

            await expect(card.getByText('✅ Готов к формированию')).toBeVisible({ timeout: 10000 })
        })
    })
})
