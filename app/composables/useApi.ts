// useFetch for a signed-in call. Public and auth pages keep the plain one, so
// a wrong password does not bounce the login page to itself.
export const useApi = createUseFetch(() => ({ $fetch: useNuxtApp().$api }));
