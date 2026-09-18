// A 401 from the API means the session is gone. One place sends the user back
// to sign in, so no page has to check for it.
export default defineNuxtPlugin((nuxtApp) => {
  const api: typeof $fetch = $fetch.create({
    onResponseError({ response }): void {
      if (response.status !== 401)
        return;
      nuxtApp.runWithContext(() => {
        useUserSession().session.value = null;
        return navigateTo(loginPath(useRoute().fullPath));
      });
    },
  });
  return { provide: { api } };
});
