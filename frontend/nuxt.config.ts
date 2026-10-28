import { readdirSync } from 'node:fs'

/** UI is grouped by feature in features/<name>/{components,composables,utils,types}. */
const FEATURES = readdirSync(new URL('./features', import.meta.url), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-04-03',
    devtools: { enabled: true },
    devServer: {
        port: 8000
    },
    modules: ['@nuxtjs/tailwindcss', '@nuxt/icon', 'nuxt-swiper', '@nuxt/content', '@nuxtjs/i18n', 'nuxt-auth-utils'],
    app: {
        head: {
            title: 'Mascotas Encontradas',
            htmlAttrs: { 'data-theme': 'mascotas' },
            meta: [
                { charset: 'utf-8' },
                { name: 'viewport', content: 'width=device-width, initial-scale=1' },
                { name: 'theme-color', content: '#FFFBF5' }
            ],
            link: [
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
                { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
                { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap'
                }
            ]
        }
    },
    i18n: {
        // Texts live in i18n.config.ts; the module still needs the list of locales it serves.
        vueI18n: './i18n.config.ts',
        strategy: 'no_prefix',
        defaultLocale: 'es',
        locales: [
            { code: 'es', language: 'es-ES', name: 'Español' },
            { code: 'en', language: 'en-US', name: 'English' }
        ]
    },
    tailwindcss: {
        cssPath: '~/assets/css/app.css'
    },
    components: [
        // Generic, feature-agnostic components.
        '~/components',
        // Feature components keep their own names (PetCard, ShareButton...) without a folder prefix.
        ...FEATURES.map(feature => ({ path: `~/features/${feature}/components`, pathPrefix: false }))
    ],
    imports: {
        dirs: ['features/*/composables', 'features/*/utils', 'features/*/types']
    },
    runtimeConfig: {
        // Server-only. Each key is overridden by its NUXT_* variable (see .env.example).
        databaseUrl: '',
        adminToken: '',
        adminEmails: '',
        internalToken: '',
        // Admin panel session (nuxt-auth-utils): sealed cookie with NUXT_SESSION_PASSWORD, valid for a week.
        session: {
            password: '',
            maxAge: 60 * 60 * 24 * 7
        },
        // Filled by NUXT_OAUTH_GOOGLE_CLIENT_ID / NUXT_OAUTH_GOOGLE_CLIENT_SECRET.
        oauth: {
            google: { clientId: '', clientSecret: '' }
        },
        cloudinary: {
            cloudName: '',
            apiKey: '',
            apiSecret: '',
            folder: 'pets'
        },
        openai: {
            apiKey: '',
            describerModel: 'gpt-4o-mini',
            moderationModel: 'gpt-6-luna'
        },
        gemini: {
            apiKey: '',
            embeddingModel: 'gemini-embedding-2-preview'
        },
        imageSearch: {
            matchFloor: 0.6,
            matchCeiling: 0.95
        },
        semanticSearch: {
            textFloor: 0.55,
            textCeiling: 0.85,
            imageFloor: 0.25,
            imageCeiling: 0.45
        },
        upstash: {
            url: '',
            token: ''
        },
        public: {
            baseUrl: 'http://localhost:8000' // en vercel agregar NUXT_PUBLIC_BASE_URL=https://mascotasdana.es
        }
    }
})
