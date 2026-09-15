// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils',
  ],

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    sessionPassword: '',
    databaseUrl: 'file:./data/linkyard.db',
    allowPrivateDestinations: false,
    geoCountryHeader: '',
    rateLimitCreatePerHour: 30,
    rateLimitRedirectPerMinute: 120,
    public: {
      shortDomain: 'http://localhost:3000',
    },
  },

  routeRules: {
    '/login': { headers: { 'X-Robots-Tag': 'noindex' } },
    '/settings/**': { headers: { 'X-Robots-Tag': 'noindex' } },
    '/links/**': { headers: { 'X-Robots-Tag': 'noindex' } },
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

  typescript: {
    strict: true,
  },
});
