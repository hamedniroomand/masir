export function assertRuntimeConfig(config: {
  sessionPassword: string;
  databaseUrl: string;
  public: { shortDomain: string };
}) {
  if (!config.sessionPassword || config.sessionPassword.length < 32)
    throw new Error('Missing or invalid NUXT_SESSION_PASSWORD (need 32+ characters)');

  if (!config.databaseUrl?.startsWith('file:'))
    throw new Error('Missing or invalid NUXT_DATABASE_URL (must start with file:)');

  try {
    const url = new URL(config.public.shortDomain);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('bad protocol');
  }
  catch {
    throw new Error('Missing or invalid NUXT_PUBLIC_SHORT_DOMAIN (must be a valid http(s) URL)');
  }
}
