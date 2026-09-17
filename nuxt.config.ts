import process from 'node:process';
import { fileURLToPath } from 'node:url';

// vercel on Vercel, bun everywhere else. Never vercel-edge: the edge runtime
// drops back to a restricted environment and Bun's own APIs stop working.
function nitroPreset(): string {
  return process.env.NITRO_PRESET ?? (process.env.VERCEL ? 'vercel' : 'bun');
}

export default defineNuxtConfig({
  alias: {
    '#scripts': fileURLToPath(new URL('./scripts', import.meta.url)),
  },

  ssr: false,

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
    migrateOnBoot: true,
    // nuxt-auth-utils declares session.cookie without a domain key, and Nitro's
    // applyEnv only overwrites keys that already exist. Without this line
    // NUXT_SESSION_COOKIE_DOMAIN can never bind, and multi-workspace mode
    // refuses to boot however the operator sets it.
    session: {
      cookie: {
        domain: '',
        // Declared so NUXT_SESSION_COOKIE_SECURE=false can bind, for an
        // instance served over plain http on a private network.
        secure: true,
      },
    },
    sessionPassword: '',
    visitorHashSecret: '',
    databaseUrl: 'postgres://masir:masir@127.0.0.1:5432/masir',
    databasePoolMax: 10,
    deploymentMode: 'SELF_HOSTED',
    rootDomain: 'http://localhost:3000',
    multiWorkspace: false,
    trialDays: 7,
    allowRegistration: false,
    mail: {
      driver: '',
      from: 'Masir <no-reply@localhost>',
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
    // Shared rate-limit counters. Empty counts inside one process only.
    // Use the Upstash TLS endpoint (rediss://), not the REST URL.
    redisUrl: '',
    // How many proxies sit in front. 0 reads the socket and ignores
    // X-Forwarded-For, because a caller can write that header themselves.
    trustedProxyDepth: 0,
    rateLimitCreatePerHour: 30,
    rateLimitRedirectPerMinute: 120,
    rateLimitPasswordPerMinute: 10,
    rateLimitUpdatePerMinute: 60,
    rateLimitSlugCheckPerMinute: 30,
    rateLimitInvitePerHour: 30,
    rateLimitWorkspacePerDay: 5,
    oauth: {
      google: { clientId: '', clientSecret: '' },
      microsoft: { clientId: '', clientSecret: '', tenant: 'common' },
    },
    public: {
      shortDomain: 'http://localhost:3000',
    },
  },

  routeRules: {
    // Every route here is the application itself. There are no marketing pages,
    // so one blanket rule beats a list that drifts as pages are added.
    // ponytail: no CSP yet. A useful one needs a report-only pass against a
    // real endpoint first, because Nuxt UI and the chart both need inline
    // styles. Tracked separately.
    '/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // Browsers ignore this over plain http, so it is safe to send always.
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      },
    },
    '/api/**': { headers: { 'Cache-Control': 'no-store' } },
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    preset: nitroPreset(),
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
