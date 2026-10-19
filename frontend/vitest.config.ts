import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['{server,contracts,composables,utils}/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['server/**/*.ts', 'contracts/**/*.ts', 'composables/**/*.ts', 'utils/**/*.ts'],
            // Wiring, Nuxt-only code and browser canvas helpers are covered by the build and manual checks.
            exclude: ['**/*.test.ts', 'server/container.ts', 'server/test/**', 'utils/images.ts'],
            reporter: ['text-summary', 'text'],
            // Enforced only with a database (as in CI): otherwise the Postgres adapter tests are skipped.
            thresholds: process.env.TEST_DATABASE_URL
                ? { lines: 90, branches: 85, functions: 90, statements: 90 }
                : undefined
        }
    }
})
