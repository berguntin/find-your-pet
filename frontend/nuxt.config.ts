// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-04-03',
    devtools: { enabled: true },
    devServer: {
        port: 8000
    },
    modules: ['@nuxtjs/tailwindcss', '@nuxt/icon', 'nuxt-swiper', '@nuxt/content', '@nuxtjs/i18n'],
    content: {
        documentDriven: true
    },
    app: {
        head: {
            title: 'Mascotas perdidas y encontradas',
            meta: [{ charset: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
            link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
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
    imports: {
        dirs: ['types']
    },
    runtimeConfig: {
        // Server-only. Each key is overridden by its NUXT_* variable (see .env.example).
        databaseUrl: '',
        adminToken: '',
        internalToken: '',
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
