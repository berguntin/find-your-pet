// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-04-03',
    devtools: { enabled: true },
    devServer: {
        port: 8000
    },
    modules: ['@nuxtjs/tailwindcss', '@nuxt/icon', 'nuxt-swiper', '@nuxt/content'],
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
    tailwindcss: {
        cssPath: '~/assets/css/app.css'
    },
    imports: {
        dirs: ['types']
    },
    runtimeConfig: {
        apiBase: process.env.NUXT_API_BASE || 'http://localhost:3000/api/', // en vercel agregar NUXT_API_BASE=https://api.mascotasdana.es/api
        public: {
            baseUrl: 'http://localhost:8000' // en vercel agregar NUXT_PUBLIC_BASE_URL=https://mascotasdana.es
        }
    }
})
