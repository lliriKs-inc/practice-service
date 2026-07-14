import { defineConfig, devices } from '@playwright/test'

// F-06: E2E — работает поверх мокового домена (localStorage), как и весь
// остальной фронт до появления интеграционного контракта на cohort/track/
// survey/invitation API (см. BACKEND_GAP_COHORT_API.md в корне репозитория).
export default defineConfig({
    testDir: './e2e',
    // Последовательно: register/login идут через реальный backend rate
    // limiter (createAuthRateLimiter) — параллельные прогоны сталкивают
    // тесты друг с другом ложными 429.
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:3002',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],
    // Next.js отказывается поднимать второй dev-сервер в этой же папке, если
    // один уже запущен (например, для ручного тестирования пользователем) —
    // поэтому переиспользуем существующий на 3002, а не поднимаем свой.
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3002',
        reuseExistingServer: true,
        timeout: 60_000,
    },
})
