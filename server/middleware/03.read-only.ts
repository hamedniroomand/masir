import { isReadOnlyEmail } from '#server/utils/read-only';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Routes that a signed-out visitor can also call. They change no workspace
// data, and sign-out must always work. Exact paths, so a new route is not
// allowed by accident.
const ALLOWED = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/forgot',
  '/api/auth/reset',
  '/api/_auth/session',
  '/api/links/verify-password',
  '/api/report',
]);

// One guard for every write, so a new route is read-only from the start.
export default defineEventHandler(async (event) => {
  if (!UNSAFE.has(event.method) || !useRuntimeConfig().readOnlyEmails)
    return;

  if (ALLOWED.has(event.path.split('?', 1)[0] ?? ''))
    return;

  const session = await getUserSession(event);
  if (isReadOnlyEmail((session.user as { email?: string } | undefined)?.email))
    throw createError({ statusCode: 403, statusMessage: 'This account is read-only. Changes are not saved.' });
});
