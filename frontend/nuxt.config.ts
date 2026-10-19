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
        vueI18n: './i18n.config.ts'
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
        upstash: {
            url: '',
            token: ''
        },
        public: {
            baseUrl: 'http://localhost:8000' // en vercel agregar NUXT_PUBLIC_BASE_URL=https://mascotasdana.es
        }
    }
})
