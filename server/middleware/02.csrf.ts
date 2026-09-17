import { getRequestHeader } from 'h3';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// SameSite=Lax is the only thing stopping a cross-site form post today.
//
// A missing Origin is allowed: browsers always send it on a cross-origin
// state-changing request, so absence means a non-browser client. Rejecting it
// would break every API caller without blocking an attack.
//
// Comparing hosts covers every deployment mode, including a workspace
// subdomain, with no list to keep current.
export default defineEventHandler((event) => {
  if (!UNSAFE.has(event.method))
    return;

  const origin = getRequestHeader(event, 'origin');
  if (!origin)
    return;

  if (URL.parse(origin)?.host !== getRequestHeader(event, 'host'))
    throw createError({ statusCode: 403, statusMessage: 'Bad origin' });
});
