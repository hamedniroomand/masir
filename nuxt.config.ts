import { readdirSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { provider } from 'std-env';
import { resolveNitroPreset } from './shared/nitro-preset';

// The build is the one place that knows the target for certain, so the
// serverless flag is decided here and read from runtimeConfig at run time.
const preset = resolveNitroPreset(process.env, provider);

// Every page under app/pages renders on the client. Read from the directory,
// so a new page needs no line here. A directory covers its index and children.
function clientOnlyRoutes() {
  const pagesDir = fileURLToPath(new URL('./app/pages', import.meta.url));
  return readdirSync(pagesDir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return [`/${entry.name}`, `/${entry.name}/**`];
    const name = entry.name.replace(/\.vue$/, '');
    return [name === 'index' ? '/' : `/${name}`];
  });
}

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
    // true on a target that keeps no disk and no process between requests.
    // Declared so NUXT_SERVERLESS=true can bind on a container that behaves
    // the same way.
    serverless: preset !== 'bun',
    sessionPassword: '',
    visitorHashSecret: '',
    databaseUrl: 'postgres://masir:masir@127.0.0.1:5432/masir',
    databasePoolMax: 10,
    deploymentMode: 'SELF_HOSTED',
    rootDomain: 'http://localhost:3000',
    multiWorkspace: false,
    allowRegistration: false,
    // Both Turnstile keys set turns on the robot check on the email forms.
    turnstileSecretKey: '',
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
      maxUploadBytes: 2_097_152,
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
      turnstileSiteKey: '',
    },
  },

  routeRules: {
    // Application pages render on the client. The server renders only what a
    // visitor without a session sees: the error page behind a short link that
    // is missing, disabled, expired, or not yet open. That page must not need
    // JavaScript, because link previews and crawlers do not run it.
    ...Object.fromEntries(clientOnlyRoutes().map(path => [path, { ssr: false }])),
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
    preset,
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
