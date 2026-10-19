import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

const NUXT_RUNTIME = [
    'useRuntimeConfig',
    'defineEventHandler',
    'readBody',
    'getQuery',
    'getRouterParam',
    'createError',
    'useStorage',
    'useNitroApp'
]

/** Hexagonal boundaries: the domain and application layers are plain TypeScript. */
const coreRestrictions = {
    'no-restricted-imports': [
        'error',
        {
            patterns: [
                {
                    group: ['#imports', 'h3', 'nitropack', 'nuxt', 'nuxt/*', '#app', 'postgres', 'cloudinary', 'openai'],
                    message: 'domain/ and application/ cannot depend on frameworks or infrastructure. Use a port.'
                },
                {
                    group: ['**/infrastructure/**', '**/contracts/**'],
                    message: 'domain/ and application/ cannot depend on adapters or HTTP contracts.'
                }
            ]
        }
    ],
    'no-restricted-syntax': [
        'error',
        {
            selector: `CallExpression[callee.name=/^(${NUXT_RUNTIME.join('|')})$/]`,
            message: 'Nuxt/Nitro auto-imports are only allowed in infrastructure/ and server/api/.'
        }
    ]
}

export default createConfigForNuxt().append(
    {
        ignores: ['.nuxt/**', '.output/**', 'node_modules/**', 'content/**']
    },
    {
        files: ['server/**/domain/**/*.ts', 'server/**/application/**/*.ts'],
        ignores: ['**/*.test.ts'],
        rules: coreRestrictions
    },
    {
        files: ['contracts/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['#imports', 'h3', 'nuxt', '#app', '**/infrastructure/**', '**/application/**'],
                            message: 'contracts/ is shared with the browser: only zod and domain values.'
                        }
                    ]
                }
            ]
        }
    },
    {
        rules: {
            // Formatting belongs to Prettier; Vue 3 allows several template roots.
            'vue/html-self-closing': 'off',
            'vue/attributes-order': 'off',
            'vue/attribute-hyphenation': 'off',
            'vue/no-multiple-template-root': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
        }
    }
)
