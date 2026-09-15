export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch: fetchSession } = useUserSession();
  await fetchSession();

  const publicPaths = ['/login', '/report'];
  const isPublic = publicPaths.includes(to.path);

  if (!loggedIn.value && !isPublic)
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);

  if (loggedIn.value && to.path === '/login')
    return navigateTo('/');
});
