import { type Page, expect } from '@playwright/test'

export function uniqueEmail(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.local`
}

export interface CandidateCreds {
    fullName: string
    email: string
    password: string
}

export async function registerViaUI(page: Page, creds: CandidateCreds) {
    await page.getByLabel('ФИО').fill(creds.fullName)
    await page.getByLabel('E-mail').fill(creds.email)
    await page.getByLabel('Пароль', { exact: true }).fill(creds.password)
    await page.getByLabel('Повторите пароль').fill(creds.password)
    await page.getByRole('button', { name: /Зарегистрироваться/ }).click()
}

export async function loginViaUI(page: Page, email: string, password: string) {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Пароль').fill(password)
    await page.getByRole('button', { name: /Войти/ }).click()
}

export async function logoutViaUI(page: Page) {
    await page.evaluate(() => {
        localStorage.removeItem('jwt')
        localStorage.removeItem('user')
    })
}

// Вопросы анкеты рендерятся без htmlFor/id-связки label↔input (визуальные
// labels), поэтому ищем поле как соседа найденного текста лейбла.
export async function fillSurveyQuestion(page: Page, labelText: string, value: string) {
    const label = page.getByText(labelText, { exact: false }).first()
    const container = label.locator('..')
    const field = container.locator('input, textarea').first()
    await field.fill(value)
}

export async function expectNoSeriousA11yViolations(page: Page) {
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}
