// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
  ],

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true },
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    preset: 'bun',
  },

  ui: {
    experimental: {
      componentDetection: true,
    },
  },

  experimental: {
    viewTransition: true,
  },

  fonts: {
    families: [{ name: 'Inter', provider: 'google', global: true }],
  },
});
