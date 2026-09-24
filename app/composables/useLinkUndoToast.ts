export function useLinkUndoToast() {
  const toast = useToast();
  const { $api } = useNuxtApp();
  const showError = useErrorToast();

  function offerUndo(title: string, undo: () => Promise<void>, onDone?: () => void | Promise<void>) {
    toast.add({
      title,
      icon: 'i-lucide-check',
      actions: [
        {
          label: 'Undo',
          onClick: () => {
            void (async () => {
              try {
                await undo();
                await onDone?.();
              }
              catch (error) {
                showError(error);
              }
            })();
          },
        },
      ],
    });
  }

  function offerExpiredRestore(linkId: string) {
    toast.add({
      title: 'Expired',
      description: 'This link is past its expiry date.',
      color: 'warning',
      icon: 'i-lucide-clock',
      actions: [
        {
          label: 'Change the expiry date',
          onClick: () => {
            void navigateTo(`/links/${linkId}?tab=settings`);
          },
        },
      ],
    });
  }

  async function restoreLink(linkId: string) {
    const restored = await $api<{ status: string }>(`/api/links/${linkId}/restore`, { method: 'POST' });
    void refreshCampaignsList();
    return restored;
  }

  return { offerUndo, offerExpiredRestore, restoreLink };
}
