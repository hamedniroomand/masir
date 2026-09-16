import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  alias: {
    '#scripts': fileURLToPath(new URL('./scripts', import.meta.url)),
  },

  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils',
  ],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
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
    rateLimitPasswordPerMinute: 10,
    rateLimitUpdatePerMinute: 60,
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
