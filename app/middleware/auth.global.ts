import { RESERVED_SLUGS } from '#shared/slug';

function isPublicShortLinkPath(path: string): boolean {
  if (/^\/p\/[a-z0-9_-]+$/.test(path))
    return true;
  const match = path.match(/^\/([a-z0-9_-]+)$/);
  if (!match)
    return false;
  return !RESERVED_SLUGS.has(match[1]!);
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch: fetchSession } = useUserSession();
  await fetchSession();

  const isPublic = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/report'].includes(to.path) || isPublicShortLinkPath(to.path);

  if (!loggedIn.value && !isPublic)
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);

  if (loggedIn.value && to.path === '/login')
    return navigateTo('/');
});
