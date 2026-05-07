// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite"

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

  routeRules: {
    '/surah/**': { isr: 3600 },
  },

  modules: [
    "nitro-cloudflare-dev",
    "@nuxt/eslint",
    "@pinia/nuxt",
    "@nuxtjs/i18n",
    "@nuxt/fonts",
    '@nuxtjs/seo',
    '@vite-pwa/nuxt',
  ],

  pwa: {
    registerType: 'autoUpdate',
    // Keep using public/manifest.json (already linked from app.head); skip module-generated manifest.
    manifest: false,
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      navigateFallback: null,
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  },

  site: {
    url: 'https://read.quran.in.th',
    name: 'อัลกุรอานแปลไทย',
    description: 'อัลกุรอานภาษาไทย - เรียนรู้อัลกุรอานภาษาไทย',
  },

  seo: {
    meta: {
      ogType: 'website',
      ogLocale: 'th_TH',
      twitterCard: 'summary_large_image',
    },
  },

  sitemap: {
    sources: ['/api/__sitemap__/urls'],
  },

  ogImage: {
    enabled: false,
  },

  fonts: {
    provider: 'google',
    defaults: {
      subsets: ['thai', 'latin'],
    },
    families: [
      {
        name: 'IBM Plex Sans Thai',
        provider: 'google',
        weights: ['100', '200', '300', '400', '500', '600', '700'],
        global: true,
      },
      {
        name: 'Sarabun',
        provider: 'google',
        weights: ['100', '200', '300', '400', '500', '600', '700', '800'],
        styles: ['normal', 'italic'],
        global: true,
      },
    ],
  },

  runtimeConfig: {
    // Server-only: used as HTTP fallback when Cloudflare service binding is unavailable
    // (e.g. during Nuxt SSR internal sub-requests where cloudflare.env is not forwarded).
    // REQUIRED in production: set NUXT_QURAN_API_URL=https://api.quran.in.th in
    // Cloudflare Worker environment variables (Workers & Pages → Settings → Variables).
    quranApiUrl: 'http://localhost:8787',
    public: {
      // Override with NUXT_PUBLIC_ASSETS_BASE_URL env var in production
      assetsBaseUrl: 'https://assets.quran.in.th',
      // Cloudflare Turnstile site key for anti-spam on public reports
      // Override with NUXT_PUBLIC_TURNSTILE_SITE_KEY env var in production
      turnstileSiteKey: '1x00000000000000000000AA',
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
      titleTemplate: '%s',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#3d3d3d' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'กุรอานไทย' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  css: ['~/assets/css/main.css', '~/assets/css/fonts.css', '~/assets/css/mushaf-scales.css', '~/assets/css/surah-name-font.css'],

  vite: {
    plugins: [tailwindcss()],
  },
})
