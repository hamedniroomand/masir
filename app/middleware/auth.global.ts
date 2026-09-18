import { RESERVED_SLUGS } from '#shared/slug';

function isPublicShortLinkPath(path: string): boolean {
  if (/^\/p\/[a-z0-9_-]+$/.test(path))
    return true;
  const match = path.match(/^\/([a-z0-9_-]+)$/);
  if (!match)
    return false;
  return !RESERVED_SLUGS.has(match[1] ?? '');
}

export default defineNuxtRouteMiddleware(async (to) => {
  // The error page is a separate render of the app. A redirect here would
  // hide it behind the login page.
  if (useError().value)
    return;

  const { loggedIn, ready, fetch: fetchSession } = useUserSession();
  if (!ready.value)
    await fetchSession();

  const isPublic = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/report'].includes(to.path) || isPublicShortLinkPath(to.path);

  if (!loggedIn.value && !isPublic)
    return navigateTo(loginPath(to.fullPath));

  if (loggedIn.value && to.path === '/login')
    return navigateTo('/');
});
