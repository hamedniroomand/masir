import { appUrl } from '#shared/deployment';

// Public. Kept for clients that read the app origin.
export default defineEventHandler(() => ({ appUrl: appUrl(useRuntimeConfig() as never) }));
