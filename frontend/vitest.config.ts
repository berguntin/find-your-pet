import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        // Integration test files share one database and empty its tables: run them one at a time.
        fileParallelism: !process.env.TEST_DATABASE_URL,
        include: ['{server,contracts,features,utils,scripts}/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: [
                'server/**/*.ts',
                'contracts/**/*.ts',
                'features/**/*.ts',
                'utils/**/*.ts',
                'scripts/lib/**/*.ts'
            ],
            // Wiring, Nuxt-only code and browser canvas helpers are covered by the build and manual checks.
            exclude: ['**/*.test.ts', 'server/container.ts', 'server/routes/auth/**', 'server/test/**', 'utils/images.ts'],
            reporter: ['text-summary', 'text'],
            // Enforced only with a database (as in CI): otherwise the Postgres adapter tests are skipped.
            thresholds: process.env.TEST_DATABASE_URL
                ? { lines: 90, branches: 85, functions: 90, statements: 90 }
                : undefined
        }
    }
})
