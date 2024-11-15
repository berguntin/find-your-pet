// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  devtools: { enabled: true },
  devServer: {
    port: 8000,
  },
  modules: ["@nuxtjs/tailwindcss", "@nuxt/icon", "nuxt-swiper"],
  app: {
    head: {
      title: "Dana Dogs",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon/favicon.ico" },
      ],
    },
  },
  tailwindcss: {
    cssPath: "~/assets/css/app.css",
  },
  imports: {
    dirs: ["types"],
  },
  runtimeConfig: {
    apiBase: process.env.NUXT_API_URL,
    openAIKey: process.env.NUXT_OPENAI_KEY,
    public: {
      baseUrl: "https://find-your-pet-five.vercel.app/"//"https://mascotasdana.es",
    },
  },
});
