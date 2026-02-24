// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  nitro: {
    preset: "cloudflare_module",

    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    }
  },

  modules: ["nitro-cloudflare-dev", "@nuxt/eslint", "@nuxtjs/tailwindcss", "@pinia/nuxt", "@nuxtjs/i18n"],

  runtimeConfig: {
    public: {
      // Override with NUXT_PUBLIC_ASSETS_BASE_URL env var in production
      assetsBaseUrl: 'https://assets.quran.in.th',
    },
  },

  i18n: {
    defaultLocale: 'th',
    locales: [
      {
        code: 'th',
        name: 'ไทย',
        file: 'th.json',
      },
    ],
    langDir: 'locales',
    strategy: 'no_prefix',
    vueI18n: './i18n/config.ts',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'th' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'อัลกุรอานภาษาไทย - คำแปลและความหมายระดับคำ' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      ],
    },
  },

  css: ['~/assets/css/fonts.css', '~/assets/css/mushaf-scales.css'],

  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
        },
      },
    },
  },
})