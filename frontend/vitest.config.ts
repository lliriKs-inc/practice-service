import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        globals: true,
        // e2e/ — спеки Playwright (F-06), у них свой раннер и конфиг
        exclude: ['**/node_modules/**', 'e2e/**'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
