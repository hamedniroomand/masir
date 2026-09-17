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
    // nuxt-auth-utils declares session.cookie without a domain key, and Nitro's
    // applyEnv only overwrites keys that already exist. Without this line
    // NUXT_SESSION_COOKIE_DOMAIN can never bind, and multi-workspace mode
    // refuses to boot however the operator sets it.
    session: {
      cookie: {
        domain: '',
      },
    },
    sessionPassword: '',
    databaseUrl: 'postgres://linkyard:linkyard@127.0.0.1:5432/linkyard',
    databasePoolMax: 10,
    deploymentMode: 'SELF_HOSTED',
    rootDomain: 'http://localhost:3000',
    multiWorkspace: false,
    trialDays: 7,
    allowRegistration: false,
    mail: {
      driver: '',
      from: 'Linkyard <no-reply@localhost>',
      apiKey: '',
      smtp: {
        host: '',
        port: 587,
        user: '',
        password: '',
        secure: false,
        poolMax: 5,
      },
    },
    storage: {
      driver: '',
      localRoot: './data/uploads',
      publicBaseUrl: 'http://localhost:3000/uploads',
      accessKeyId: '',
      secretAccessKey: '',
      bucket: '',
      endpoint: '',
    },
    allowPrivateDestinations: false,
    geoCountryHeader: '',
    rateLimitLoginPerMinute: 10,
    // How many proxies sit in front. 0 reads the socket and ignores
    // X-Forwarded-For, because a caller can write that header themselves.
    trustedProxyDepth: 0,
    rateLimitCreatePerHour: 30,
    rateLimitRedirectPerMinute: 120,
    rateLimitPasswordPerMinute: 10,
    rateLimitUpdatePerMinute: 60,
    rateLimitSlugCheckPerMinute: 30,
    rateLimitInvitePerHour: 30,
    oauth: {
      google: { clientId: '', clientSecret: '' },
      microsoft: { clientId: '', clientSecret: '', tenant: 'common' },
    },
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
