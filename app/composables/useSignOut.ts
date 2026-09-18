export function useSignOut() {
  const { clear } = useUserSession();
  const showError = useErrorToast();
  return async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' });
    }
    catch (error) {
      showError(error);
    }
    await clear();
    await navigateTo('/login');
  };
}
