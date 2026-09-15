export function useErrorToast() {
  const toast = useToast();
  return (error: unknown) => {
    const { statusMessage } = error as { statusMessage?: string };
    toast.add({
      title: statusMessage || 'Something went wrong. Try again.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  };
}
