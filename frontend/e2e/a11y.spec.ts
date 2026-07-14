import { test, expect } from '@playwright/test'
import { expectNoSeriousA11yViolations } from './helpers'

// F-06: доступность (axe) + базовая клавиатурная навигация на публичных
// страницах, которые не требуют предварительного состояния/логина.
test.describe('Доступность публичных страниц', () => {
    test('главная страница без серьёзных нарушений axe', async ({ page }) => {
        await page.goto('/')
        await expectNoSeriousA11yViolations(page)
    })

    test('страница входа без серьёзных нарушений axe и с рабочей клавиатурной навигацией', async ({ page }) => {
        await page.goto('/login')
        await expectNoSeriousA11yViolations(page)

        // Форму целиком можно заполнить и отправить с клавиатуры, без мыши —
        // не завязываемся на точный порядок Tab между полями (base-ui Input
        // может вставлять служебные элементы), проверяем результат.
        await page.getByLabel('E-mail').focus()
        await page.keyboard.type('admin@academy.com')
        await page.getByLabel('Пароль').focus()
        await page.keyboard.type('password123')
        await page.keyboard.press('Enter')
        await expect(page).toHaveURL(/\/admin\/cohorts/, { timeout: 10000 })
    })

    test('страница регистрации без серьёзных нарушений axe', async ({ page }) => {
        await page.goto('/register')
        await expectNoSeriousA11yViolations(page)
    })

    test('невалидная ссылка-приглашение без серьёзных нарушений axe', async ({ page }) => {
        await page.goto('/apply/invalid-token-xyz')
        await expect(page.getByRole('heading', { name: 'Ссылка недействительна' })).toBeVisible()
        await expectNoSeriousA11yViolations(page)
    })
})
