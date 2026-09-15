export function useLinkEnabledMutation() {
  const pending = ref(false);

  async function setLinkEnabled(linkId: string, isEnabled: boolean) {
    pending.value = true;
    try {
      await $fetch(`/api/links/${linkId}`, {
        method: 'PATCH',
        body: { isEnabled },
      });
    }
    finally {
      pending.value = false;
    }
  }

  return { pending, setLinkEnabled };
}
