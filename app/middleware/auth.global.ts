export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, user, fetch: fetchSession } = useUserSession();
  await fetchSession();

  const isPublic = ['/login', '/report'].includes(to.path);

  if (!loggedIn.value && !isPublic)
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);

  if (loggedIn.value && to.path === '/login')
    return navigateTo('/');

  if (to.path.startsWith('/settings/') && user.value?.role !== 'admin')
    return abortNavigation(createError({ statusCode: 403 }));
});
